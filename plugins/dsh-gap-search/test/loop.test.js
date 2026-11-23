import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { candidatePath } from '../../dsh-evolve-loop/src/candidates.js'
import { filesOf } from '../../dsh-evolve-loop/src/files.js'
import { populationOf } from '../../dsh-evolve-loop/src/population.js'
import { run } from '../src/loop.js'

const PARENT = `#EVOLVE_START
int main(){return 0;}
#EVOLVE_END
`
const CHILD = `#EVOLVE_START
int pets = 20;
if (pets == 20) {}
int main(){return 0;}
#EVOLVE_END
`

function profile(improved) {
  const rows = []
  for (let seed = 0; seed < 50; seed += 1) {
    const writing = seed < 5
    rows.push({
      seed,
      raw: writing ? (improved ? 2e7 : 1e7) : 1e8,
      judge: 'ACCEPTED',
      execution_time: writing && improved ? 0.8 : 0.2,
      features: { pets: writing ? 20 : 10, humans: 5 },
      M: 1e8,
      q: writing ? (improved ? 0.2 : 0.1) : 1,
      gap: writing ? (improved ? 8e7 : 9e7) : 0,
      scale: 1e8,
      failure: writing ? 'unused_time' : null,
      accepted: true,
    })
  }
  return {
    problem_id: 'ahc008',
    time_limit: 3,
    loose_ruler: false,
    reference_used: false,
    rows,
  }
}

async function makeTask(ale) {
  const task = await mkdtemp(join(tmpdir(), 'gap-task-'))
  const root = join(task, 'run')
  await mkdir(join(task, 'evaluator'), { recursive: true })
  const body = ale
    ? 'problem_id = "ahc008"\nstart_ale_bench_session()\n'
    : 'def evaluate(program_path):\n    return {"combined_score": 1}\n'
  await writeFile(join(task, 'evaluator', 'evaluator.py'), body)
  await writeFile(join(task, 'task.json'), JSON.stringify({ program: 'solution.cpp', timeout: 10, max_retries: 0 }))
  return { task, root }
}

function host(task, root, hooks) {
  const signal = new AbortController().signal
  const files = filesOf(root)
  const population = populationOf(root)
  return {
    currentRun: () => ({ task, root, signal, k: 5, maxPopulation: 10 }),
    context: async () => ({ budget: { remaining: 5 }, maxPopulation: 10, candidates: 1, k: 5 }),
    population: () => population,
    files,
    ctx: { get() { return undefined } },
    async copyTask() {
      const dir = candidatePath(root, 'c000000')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'solution.cpp'), PARENT)
      return { id: 'c000000', dir }
    },
    async allocate(parentId) {
      const dir = candidatePath(root, 'c000001')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'solution.cpp'), await readFile(join(candidatePath(root, parentId), 'solution.cpp'), 'utf8'))
      return { id: 'c000001', dir }
    },
    async evaluate(candidate) {
      const improved = candidate.id !== 'c000000' && hooks.improve !== false
      const fitness = candidate.id === 'c000000' ? 10 : 40
      const body = { fitness, metrics: { combined_score: fitness, seed_profile: profile(improved && hooks.rise !== false) } }
      await files.write(`evals/${candidate.id}.json`, `${JSON.stringify(body)}\n`)
      hooks.evaluated.push(candidate.id)
      return fitness
    },
    async spawnWorker(dir) {
      hooks.spawned += 1
      await writeFile(join(dir, 'solution.cpp'), hooks.child ?? CHILD)
    },
    async select(populationHandle) {
      const { select } = await import('../src/select.js')
      return select(populationHandle, this)
    },
    async mutate(options) {
      const { mutate } = await import('../src/mutate.js')
      return mutate(options, this)
    },
    async survive(populationHandle) {
      const { survive } = await import('../src/survive.js')
      return survive(populationHandle, this)
    },
  }
}

test('a passing edit moves the writing parent and keeps the official best', async () => {
  const { task, root } = await makeTask(true)
  const hooks = { spawned: 0, evaluated: [], rise: true, improve: true }
  try {
    const result = await run({}, host(task, root, hooks))
    const state = JSON.parse(await filesOf(root).read('gap/state.json'))
    assert.equal(result.best_id, 'c000001')
    assert.equal(result.best_fitness, 40)
    assert.equal(state.writing_parent, 'c000001')
    assert.equal(hooks.spawned, 1)
    assert.equal(hooks.evaluated.length, 2)
    const log = await filesOf(root).read('gap/log.jsonl')
    assert.match(log, /"accepted":true/)
    assert.match(log, /"deltas":\[/)
  } finally {
    await rm(task, { recursive: true, force: true })
  }
})

test('a failed clock keeps the writing parent while the official score can still win', async () => {
  const { task, root } = await makeTask(true)
  const hooks = { spawned: 0, evaluated: [], rise: false, improve: true }
  try {
    const result = await run({}, host(task, root, hooks))
    const state = JSON.parse(await filesOf(root).read('gap/state.json'))
    assert.equal(result.best_id, 'c000001')
    assert.equal(state.writing_parent, 'c000000')
    assert.match(JSON.stringify(state.rejected), /heavier-search/)
    const rows = await populationOf(root).rows()
    assert.equal(rows.length, 2)
    assert.equal(rows[1].fitness, 40)
  } finally {
    await rm(task, { recursive: true, force: true })
  }
})

test('no writable class spends no budget unit', async () => {
  const { task, root } = await makeTask(true)
  const hooks = { spawned: 0, evaluated: [], rise: true, improve: true }
  const evolve = host(task, root, hooks)
  const original = evolve.evaluate
  evolve.evaluate = async candidate => {
    const fitness = 10
    const claimed = profile(false)
    for (const row of claimed.rows) {
      row.failure = null
      row.q = 1
      row.gap = 0
      row.raw = 1e8
      row.features = { pets: 10 }
    }
    await evolve.files.write(`evals/${candidate.id}.json`, `${JSON.stringify({
      fitness,
      metrics: { combined_score: fitness, seed_profile: claimed },
    })}\n`)
    return fitness
  }
  try {
    const result = await run({}, evolve)
    assert.equal(result.stop_reason, 'no-recoverable-gap')
    assert.equal(result.best_id, 'c000000')
    assert.equal(hooks.spawned, 0)
    assert.equal(original, original)
  } finally {
    await rm(task, { recursive: true, force: true })
  }
})

test('a later mutate receives the gap assignment and any carried lessons', async () => {
  const { task, root } = await makeTask(true)
  const hooks = { spawned: 0, evaluated: [], rise: true, improve: true }
  const evolve = host(task, root, hooks)
  const seen = []
  evolve.mutate = async options => {
    seen.push({ mechanism: options.assignment?.mechanism, prompt: options.prompt })
    const candidate = await evolve.allocate(options.parent)
    await writeFile(join(candidate.dir, 'solution.cpp'), CHILD)
    return candidate
  }
  try {
    await filesOf(root).write('gap/lessons.md', 'Keep the heavier search inside the same feature cut.\n')
    await run({}, evolve)
    assert.equal(seen.length, 1)
    assert.equal(seen[0].mechanism, 'heavier-search')
    assert.match(seen[0].prompt, /Keep the heavier search inside the same feature cut/)
    assert.equal(hooks.spawned, 0)
  } finally {
    await rm(task, { recursive: true, force: true })
  }
})

test('a non ALE-Bench task uses the original loop and does not spawn a gap worker', async () => {
  const { task, root } = await makeTask(false)
  const hooks = { spawned: 0, evaluated: [] }
  const evolve = host(task, root, hooks)
  evolve.context = async () => ({ budget: { remaining: 0 }, maxPopulation: 10, candidates: 1, k: 5 })
  evolve.evaluate = async () => 7
  try {
    const result = await run({}, evolve)
    assert.equal(result.best_id, 'c000000')
    assert.equal(result.best_fitness, 7)
    assert.equal(hooks.spawned, 0)
    assert.equal(await filesOf(root).read('gap/state.json'), undefined)
  } finally {
    await rm(task, { recursive: true, force: true })
  }
})

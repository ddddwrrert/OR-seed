import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { run as originalRun } from '../../dsh-evolve-loop/src/providers/loop.js'
import { alive, merit } from '../../dsh-evolve-loop/src/population.js'
import { candidatePath } from '../../dsh-evolve-loop/src/candidates.js'
import { taskKind } from './ale.js'
import { judge } from './accept.js'
import { decide } from './decide.js'
import { buildPrompt } from './prompt.js'
import { dropMechanism, pick, timeDirection } from './schedule.js'
import {
  LOG_PATH,
  ensureRecords,
  loadEvalProfile,
  profilePath,
  readProfile,
  rememberScales,
  writeState,
} from './state.js'

export const name = 'gap-search'

/**
 * ALE-Bench spends each budget unit on one class and one mechanism.
 * Every other task uses the original loop, select, mutate, and survive.
 * @param {object} args
 * @param {object} evolve
 */
export async function run(args, evolve) {
  const kind = await taskKind(evolve.currentRun().task)
  if (!kind.ale) return originalRun(args, evolve)
  return aleRun(evolve)
}

async function aleRun(evolve) {
  const runState = evolve.currentRun()
  const { maxPopulation, candidates } = await evolve.context()
  const population = evolve.population()
  const files = evolve.files

  let { rows, state } = await ensureRecords(files, population)
  if (rows.length === 0) {
    const base = await evolve.copyTask()
    const fitness = await evolve.evaluate(base)
    let profile
    try {
      profile = await loadEvalProfile(files, base.id)
    } catch (error) {
      await population.append({ id: base.id, parent: null, fitness, survival: 'yes' })
      throw error
    }
    await files.write(profilePath(base.id), `${JSON.stringify(profile)}\n`)
    await rememberScales(files, profile)
    state = {
      writing_parent: base.id,
      rejected: {},
      loose_ruler: Boolean(profile.loose_ruler),
      reference_used: Boolean(profile.reference_used),
      problem_id: profile.problem_id,
    }
    await writeState(files, state)
    if (profile.loose_ruler || profile.reference_used) {
      await files.append(LOG_PATH, `${JSON.stringify({
        event: 'ruler',
        problem_id: profile.problem_id,
        loose_ruler: Boolean(profile.loose_ruler),
        reference_used: Boolean(profile.reference_used),
      })}\n`)
    }
    await population.append({ id: base.id, parent: null, fitness, survival: 'yes' })
    rows = await population.rows()
  }

  const limit = candidates ?? Infinity
  let created = 0
  let stopReason = null
  const program = JSON.parse(await readFile(join(runState.task, 'task.json'), 'utf8')).program

  while ((await evolve.context()).budget.remaining > 0 && created < limit) {
    runState.signal.throwIfAborted()
    const parentId = await evolve.select(population)
    const parentRow = (await population.rows()).find(row => row.id === parentId)
    const parentProfile = await readProfile(files, parentId)
    const decision = await decide(parentProfile.rows, evolve)
    const picked = pick(decision.bins, state.rejected ?? {})
    if (!picked) {
      stopReason = 'no-recoverable-gap'
      break
    }
    const direction = timeDirection(picked.mechanism)
    const assignment = {
      bin: picked.bin,
      mechanism: picked.mechanism,
      direction,
      officialFitness: parentRow?.fitness,
    }
    const candidate = await evolve.mutate({ parent: parentId, assignment, prompt: buildPrompt(assignment) })
    created += 1
    const fitness = await evolve.evaluate(candidate)
    let childProfile
    try {
      childProfile = await loadEvalProfile(files, candidate.id)
    } catch (error) {
      await population.append({
        id: candidate.id,
        parent: parentId,
        fitness,
        survival: 'yes',
      })
      throw error
    }
    await files.write(profilePath(candidate.id), `${JSON.stringify(childProfile)}\n`)

    const before = await readFile(join(candidatePath(runState.root, parentId), program), 'utf8')
    const after = await readFile(join(candidate.dir, program), 'utf8')
    const verdict = judge({
      parentRows: parentProfile.rows,
      childRows: childProfile.rows,
      bin: picked.bin,
      guard: decision.guard,
      mechanism: picked.mechanism,
      direction,
      before,
      after,
      limit: parentProfile.time_limit,
    })
    await files.append(LOG_PATH, `${JSON.stringify({
      event: 'attempt',
      parent: parentId,
      child: candidate.id,
      mechanism: picked.mechanism,
      bin: picked.bin.id,
      failure: picked.bin.failure,
      official_fitness: fitness,
      mean_delta: verdict.mean_delta,
      negative: verdict.negative,
      deltas: verdict.deltas,
      reasons: verdict.reasons,
      accepted: verdict.ok,
      time: verdict.time,
      loose_ruler: Boolean(state.loose_ruler),
    })}\n`)

    state = verdict.ok
      ? { ...state, writing_parent: candidate.id, rejected: {} }
      : { ...state, rejected: dropMechanism(state.rejected, picked.bin.id, picked.mechanism) }
    await writeState(files, state)
    await population.append({
      id: candidate.id,
      parent: parentId,
      fitness,
      survival: 'yes',
    })
    rows = await population.rows()
    if (alive(rows).length >= maxPopulation) {
      await evolve.survive(population)
      rows = await population.rows()
    }
  }

  rows = await population.rows()
  let best = rows[0]
  for (const row of rows) {
    if (best === undefined || merit(row.fitness) > merit(best.fitness)) best = row
  }
  const budget = (await evolve.context()).budget
  return {
    best_id: best?.id ?? 'c000000',
    best_fitness: best?.fitness ?? 0,
    remaining: budget.remaining,
    ...(stopReason ? { stop_reason: stopReason } : {}),
  }
}

export default { name, run }

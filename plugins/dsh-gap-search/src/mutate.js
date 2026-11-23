import { mutate as classicMutate } from '../../dsh-evolve-loop/src/providers/mutate.js'
import { taskKind } from './ale.js'
import { PERSONA } from './prompt.js'

export const name = 'gap-assignment'

/**
 * One allocate and one worker. The worker is told the single mechanism the checker will judge.
 * Non-ALE-Bench uses the original candidate builder, which allocates once itself.
 * @param {object} options
 * @param {object} evolve
 * @returns {Promise<{ id: string, dir: string }>}
 */
export async function mutate(options, evolve) {
  if (!(await taskKind(evolve.currentRun().task)).ale) return classicMutate(options, evolve)
  const parent = options?.parent
  const assignment = options?.assignment
  if (!parent) throw new Error('mutate needs a parent candidate id')
  if (!assignment?.mechanism || !assignment?.bin) throw new Error('gap mutate needs one mechanism assignment')
  const prompt = options.prompt
  if (typeof prompt !== 'string' || prompt === '') throw new Error('gap mutate needs the prompt built for this assignment')

  const candidate = await evolve.allocate(parent)
  try {
    await evolve.spawnWorker(candidate.dir, prompt, {
      label: 'gap-search',
      persona: PERSONA,
      allowShell: options.allowShell ?? true,
    })
  } catch (error) {
    const current = evolve.currentRun?.()
    if (current?.signal?.aborted) throw error
  }
  return candidate
}

export default { name, mutate }

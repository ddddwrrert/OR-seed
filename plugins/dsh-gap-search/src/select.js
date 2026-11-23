import { select as classicSelect } from '../../dsh-evolve-loop/src/providers/select.js'
import { taskKind } from './ale.js'
import { readState } from './state.js'

export const name = 'gap-writing-parent'

/**
 * The writing parent is the last program whose edit passed δ and the clock.
 * A survival-no row is not brought back. Non-ALE-Bench uses fitness-proportional selection.
 * @param {object} population
 * @param {object} evolve
 * @returns {Promise<string>}
 */
export async function select(population, evolve) {
  if (!(await taskKind(evolve.currentRun().task)).ale) return classicSelect(population, evolve)
  const rows = await population.rows()
  const state = await readState(evolve.files)
  const id = state?.writing_parent
  const row = rows.find(item => item.id === id)
  if (!row || row.survival !== 'yes') {
    throw new Error(`writing parent ${String(id)} is not an alive candidate; a survival-no row is not resurrected`)
  }
  return id
}

export default { name, select }

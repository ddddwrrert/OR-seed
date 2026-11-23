import { survive as classicSurvive } from '../../dsh-evolve-loop/src/providers/survive.js'
import { merit } from '../../dsh-evolve-loop/src/population.js'
import { DEFAULT_K } from '../../dsh-evolve-loop/src/evolve.js'
import { taskKind } from './ale.js'
import { readState } from './state.js'

export const name = 'gap-keep-base'

/**
 * Ids that stay alive. Required ids are kept even when that exceeds k.
 * A row that is already survival-no is not added back.
 * @param {object[]} rows
 * @param {number} k
 * @param {string | undefined} writingParent
 * @returns {Set<string>}
 */
export function keptIds(rows, k, writingParent) {
  const pool = rows.filter(row => row.survival === 'yes')
  const ranked = [...pool].sort((a, b) => merit(b.fitness) - merit(a.fitness))
  const best = ranked[0]
  const required = []
  if (writingParent && pool.some(row => row.id === writingParent)) required.push(writingParent)
  if (best && !required.includes(best.id)) required.push(best.id)
  const survivors = new Set(required)
  const cap = k ?? DEFAULT_K
  for (const row of ranked) {
    if (survivors.size >= cap) break
    survivors.add(row.id)
  }
  return survivors
}

/**
 * @param {object} population
 * @param {object} evolve
 */
export async function survive(population, evolve) {
  if (!(await taskKind(evolve.currentRun().task)).ale) return classicSurvive(population, evolve)
  const { k } = await evolve.context()
  const rows = await population.rows()
  const state = await readState(evolve.files)
  const survivors = keptIds(rows, k ?? DEFAULT_K, state?.writing_parent)
  await population.write(rows.map(row => (
    row.survival === 'yes' && !survivors.has(row.id) ? { ...row, survival: 'no' } : row
  )))
}

export default { name, survive }

import { QUEUES } from './constants.js'

/**
 * Clock direction follows the one mechanism that was dequeued.
 * heavier-search must use more time. cheaper-step and focus-state must use less,
 * or, when the parent already fills the limit, must not use more.
 * @param {string} mechanism
 * @returns {'rise' | 'fall' | 'none'}
 */
export function timeDirection(mechanism) {
  if (mechanism === 'heavier-search') return 'rise'
  if (mechanism === 'cheaper-step' || mechanism === 'focus-state') return 'fall'
  return 'none'
}

/**
 * @param {{ id: string, failure: string }} bin
 * @param {Record<string, string[]>} rejected
 * @returns {string | null}
 */
export function nextMechanism(bin, rejected) {
  const used = new Set(rejected?.[bin.id] ?? [])
  for (const name of QUEUES[bin.failure] ?? []) {
    if (!used.has(name)) return name
  }
  return null
}

/**
 * First class, in gap order, that still has a mechanism name left.
 * One name per call. A rejected name is already absent from the queue.
 * @param {object[]} bins
 * @param {Record<string, string[]>} rejected
 * @returns {{ bin: object, mechanism: string } | null}
 */
export function pick(bins, rejected) {
  for (const bin of bins ?? []) {
    const mechanism = nextMechanism(bin, rejected)
    if (mechanism) return { bin, mechanism }
  }
  return null
}

/**
 * @param {Record<string, string[]>} rejected
 * @param {string} binId
 * @param {string} mechanism
 * @returns {Record<string, string[]>}
 */
export function dropMechanism(rejected, binId, mechanism) {
  const next = { ...(rejected ?? {}) }
  const list = next[binId] ?? []
  if (!list.includes(mechanism)) next[binId] = [...list, mechanism]
  return next
}

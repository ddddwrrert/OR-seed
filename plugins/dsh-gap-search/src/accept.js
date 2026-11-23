import {
  BULK,
  CLEAR_DELTA,
  EXHAUSTED_FRACTION,
  GUARD_DROP,
  TIME_EPS_FRACTION,
} from './constants.js'
import { editShape } from './diff.js'
import { timeDirection } from './schedule.js'

/**
 * Fraction of the ruler recovered. Positive means the gap got smaller.
 * On a maximize task with scale = M this is (s' − s) / M.
 * @param {{ gap: number, scale: number }} parent
 * @param {{ gap: number }} child
 * @returns {number}
 */
export function deltaOf(parent, child) {
  const scale = parent.scale > 0 ? parent.scale : 1
  return (parent.gap - child.gap) / scale
}

function indexRows(rows) {
  const map = new Map()
  for (const row of rows ?? []) map.set(row.seed, row)
  return map
}

function mean(values) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * @param {object} args
 * @returns {object}
 */
export function judge(args) {
  const {
    parentRows,
    childRows,
    bin,
    guard,
    mechanism,
    before,
    after,
    limit,
  } = args
  const direction = args.direction ?? timeDirection(mechanism)
  const parent = indexRows(parentRows)
  const child = indexRows(childRows)
  const reasons = []
  const deltas = []

  for (const seed of [...parent.keys()].sort((a, b) => a - b)) {
    const left = parent.get(seed)
    const right = child.get(seed)
    if (!right) {
      reasons.push('missing-seed')
      continue
    }
    deltas.push({
      seed,
      delta: deltaOf(left, right),
      parent_time: left.execution_time,
      child_time: right.execution_time,
      gap_before: left.gap,
      gap_after: right.gap,
    })
  }

  const bySeed = new Map(deltas.map(row => [row.seed, row]))
  const writing = []
  for (const seed of bin.seeds ?? []) {
    const row = bySeed.get(seed)
    if (!row) {
      reasons.push('missing-target')
      continue
    }
    writing.push(row)
  }
  const guardRows = []
  for (const seed of guard ?? []) {
    const row = bySeed.get(seed)
    if (!row) {
      reasons.push('missing-guard')
      continue
    }
    guardRows.push(row)
  }

  const meanDelta = mean(writing.map(row => row.delta))
  if (!(meanDelta > CLEAR_DELTA)) reasons.push('target-not-recovered')

  const guardDrop = guardRows.filter(row => row.delta < GUARD_DROP).length
  if (guardRows.length > 0 && guardDrop / guardRows.length > BULK) reasons.push('guard-given-back')

  const time = clockCheck(direction, writing, limit)
  if (!time.ok) reasons.push(direction === 'rise' ? 'time-not-up' : 'time-not-down')
  const guardClock = guardClockCheck(guardRows, limit)
  if (!guardClock.ok) reasons.push('guard-time-rose')

  const shape = editShape(before, after, bin, mechanism)
  if (shape) reasons.push(shape)

  const unique = [...new Set(reasons)]
  return {
    ok: unique.length === 0,
    reasons: unique,
    direction,
    mean_delta: meanDelta,
    negative: deltas.filter(row => row.delta < 0).length,
    deltas,
    time,
    guard_clock: guardClock,
    guard_drop: guardRows.length === 0 ? 0 : guardDrop / guardRows.length,
  }
}

function clockCheck(direction, writing, limit) {
  if (direction === 'none' || writing.length === 0) return { ok: true, check: 'skipped' }
  const before = mean(writing.map(row => row.parent_time))
  const after = mean(writing.map(row => row.child_time))
  const eps = Math.max((limit || 0) * TIME_EPS_FRACTION, 1e-6)
  if (direction === 'rise') {
    return { ok: after > before + eps, check: 'rise', before, after }
  }
  if (after < before - eps) return { ok: true, check: 'fall', before, after }
  const pegged = before >= (limit || 0) * EXHAUSTED_FRACTION && after <= before + eps
  return { ok: pegged, check: pegged ? 'capped-not-longer' : 'fall', before, after }
}

function guardClockCheck(guardRows, limit) {
  if (guardRows.length === 0) return { ok: true, check: 'empty' }
  const eps = Math.max((limit || 0) * TIME_EPS_FRACTION, 1e-6)
  const risen = guardRows.filter(row => row.child_time > row.parent_time + eps).length
  return { ok: risen / guardRows.length <= BULK, risen, total: guardRows.length }
}

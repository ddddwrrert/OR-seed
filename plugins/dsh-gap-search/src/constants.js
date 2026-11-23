/** Thresholds shared by the prompt and the acceptance check. group.py uses the same 0.95 and 3. */

export const CLEAR_DELTA = 0.05
export const GUARD_DROP = -0.05
export const BULK = 0.5
export const Q_CLAIMED = 0.95
export const MIN_CLASS = 3
export const TIME_EPS_FRACTION = 0.02
export const EXHAUSTED_FRACTION = 0.85

export const QUEUES = Object.freeze({
  unused_time: Object.freeze(['heavier-search']),
  time_exhausted: Object.freeze(['cheaper-step', 'focus-state']),
  search_stuck: Object.freeze(['construction', 'neighborhood']),
  invalid: Object.freeze(['state-invariant']),
})

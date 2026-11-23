import { CLEAR_DELTA, GUARD_DROP, Q_CLAIMED } from './constants.js'

const MECHANISM_TEXT = {
  'heavier-search': 'The search on this class stops while time remains and the score is still short of the ruler. Spend that remaining time on a heavier search: more iterations, a wider beam, or more restarts.',
  'cheaper-step': 'The search on this class runs until the time limit and the score is still short of the ruler. Make one step cheaper so more steps fit in the limit.',
  'focus-state': 'The search on this class runs until the time limit and the score is still short of the ruler. Spend the iterations on the part of the state that is actually bad.',
  construction: 'The search on this class uses its time and still finishes short of the ruler. Change how the first state is built, so an early choice is not frozen.',
  neighborhood: 'The search on this class uses its time and still finishes short of the ruler. Change the moves so one step can reach the bottleneck.',
  'state-invariant': 'This class breaks a constraint. Change the state so that illegal state cannot be constructed. Do not only change a penalty or a weight.',
}

export const PERSONA = 'You edit one candidate. Implement exactly one mechanism, in one contiguous block, branching on the named input quantities. Do not run the official evaluator.'

/**
 * The worker prompt is built from the same assignment the checker will use.
 * @param {object} assignment
 * @returns {string}
 */
export function buildPrompt(assignment) {
  const { bin, mechanism, direction, officialFitness } = assignment
  const lines = [
    'Read the task statement and the parent solution in this directory.',
    `The parent official fitness (combined_score) is ${officialFitness}. The contest result stays that sum.`,
    `Implement only \`${mechanism}\`.`,
    MECHANISM_TEXT[mechanism] ?? 'Change only the named mechanism.',
  ]
  if (bin.size_level === 'lo') {
    lines.push('This class is the small side of its size quantity. Small inputs should spend saved time on a heavier search.')
  } else if (bin.size_level === 'hi') {
    lines.push('This class is the large side of its size quantity. Large inputs should use a cheaper step, or spend the iterations on the part of the state that is actually bad.')
  }
  const features = bin.features ?? []
  if (features.length === 0) {
    lines.push('This class is not split by an input quantity. Change the one mechanism in one block.')
  } else {
    lines.push('Branch on every quantity below. Use these identifiers and these cuts:')
    for (const feature of features) {
      lines.push(`- \`${feature.token} ${feature.op} ${feature.threshold}\``)
    }
    lines.push('The new lines must contain each identifier and each cut. The branch reads the input, not a case number.')
  }
  lines.push('Add one contiguous block. Unchanged lines between new lines count as two edits and the edit is rejected.')
  lines.push('Do not branch on a public case number. A new line that names the batch, or compares an id with a case number, is rejected.')
  lines.push('Edit only between #EVOLVE_START and #EVOLVE_END. Leave every other file unchanged.')
  lines.push('Do not run the official evaluator or a performance benchmark. The search scores the candidate after you finish.')
  lines.push(`The edit becomes the writing parent only when the mean δ of this class is greater than ${CLEAR_DELTA}. δ = (gap before − gap after) / scale. On a maximize task that is (s' − s) / M.`)
  lines.push(`Seeds already at q >= ${Q_CLAIMED} are a guard, not a writing target. The edit is rejected when more than half of them have δ < ${GUARD_DROP}, or when more than half of them use more time.`)
  if (direction === 'rise') {
    lines.push('The measured execution_time of this class must rise. A comment or a variable that says time does not pass.')
  } else if (direction === 'fall') {
    lines.push('The measured execution_time of this class must fall. If the parent already fills the time limit, the child must not run longer. A comment or a variable that says time does not pass.')
  } else {
    lines.push('This mechanism is not accepted because the source mentions time. The guard class must not use more time in bulk.')
  }
  if (mechanism === 'state-invariant') {
    lines.push('A diff that only assigns a penalty or a weight is rejected.')
  }
  lines.push('This directory is one candidate and one solution. Do not write a second implementation.')
  return lines.join('\n')
}

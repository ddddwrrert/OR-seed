/**
 * One contiguous added block. The block must name this class's input quantities.
 * The word seed, or a seed index used as a branch, rejects the edit.
 */

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lcsMatched(before, after) {
  const n = before.length
  const m = after.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]
    const next = dp[i + 1]
    for (let j = m - 1; j >= 0; j--) {
      row[j] = before[i] === after[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1])
    }
  }
  const matched = new Array(m).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      matched[j] = true
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }
  return matched
}

/**
 * Added lines in the new file, split wherever an old line sits between them.
 * @param {string} before
 * @param {string} after
 * @returns {string[][]}
 */
export function addedRuns(before, after) {
  const oldLines = String(before).split(/\r?\n/)
  const newLines = String(after).split(/\r?\n/)
  const matched = lcsMatched(oldLines, newLines)
  const runs = []
  let cursor = 0
  while (cursor < newLines.length) {
    if (matched[cursor]) {
      cursor += 1
      continue
    }
    const start = cursor
    while (cursor < newLines.length && !matched[cursor]) cursor += 1
    const lines = newLines.slice(start, cursor)
    if (lines.some(line => line.trim() !== '')) runs.push(lines)
  }
  return runs
}

function markerInner(text) {
  const start = text.indexOf('#EVOLVE_START')
  const end = text.indexOf('#EVOLVE_END')
  if (start < 0 || end < 0 || end < start) return null
  return text.slice(start, end + '#EVOLVE_END'.length)
}

/**
 * @param {string} before
 * @param {string} after
 * @param {{ features?: { token: string, threshold: number | string }[], seeds?: number[] }} bin
 * @param {string} mechanism
 * @returns {string | null} rejection code, or null when the diff is one legal block
 */
export function editShape(before, after, bin, mechanism) {
  if (String(before).includes('#EVOLVE_START') && String(after).includes('#EVOLVE_START')) {
    const oldInner = markerInner(String(before))
    const newInner = markerInner(String(after))
    if (oldInner === null || newInner === null) return 'markers'
    if (String(before).replace(oldInner, '') !== String(after).replace(newInner, '')) return 'outside-markers'
  }
  const runs = addedRuns(before, after)
  if (runs.length === 0) return 'no-added-lines'
  if (runs.length > 1) return 'two-regions'
  const lines = runs[0]
  const text = lines.join('\n')
  if (/\bseed\b/i.test(text) || /\b(seed_id|case_id|testcase|test_case)\b/i.test(text)) return 'seed-word'
  const tokens = (bin.features ?? []).map(feature => feature.token)
  const seeds = bin.seeds ?? []
  for (const line of lines) {
    const namesFeature = tokens.some(token => new RegExp(`\\b${escapeRegExp(token)}\\b`).test(line))
    if (namesFeature) continue
    for (const id of seeds) {
      if (new RegExp(`(==|!=)\\s*${id}\\b`).test(line) || new RegExp(`\\bcase\\s+${id}\\s*:`).test(line)) {
        return 'seed-index'
      }
    }
  }
  for (const feature of bin.features ?? []) {
    if (!new RegExp(`\\b${escapeRegExp(feature.token)}\\b`).test(text)) return 'missing-feature'
    if (!text.includes(String(feature.threshold))) return 'missing-threshold'
  }
  if ((bin.features ?? []).length > 0 && !/(<=|>=|==|!=|<|>)/.test(text)) return 'missing-branch'
  if (mechanism === 'state-invariant' && penaltyOnly(lines)) return 'penalty-only'
  return null
}

function penaltyOnly(lines) {
  const code = lines.filter(line => {
    const trimmed = line.trim()
    return trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')
  })
  if (code.length === 0) return false
  const stateWord = /\b(struct|class|invariant|undo|rollback|repair|neighbor|swap|state)\b/i
  if (code.some(line => stateWord.test(line))) return false
  const penaltyWord = /\b(penalty|weight|lambda|coeff)\b/i
  return code.every(line => penaltyWord.test(line) && line.includes('='))
}

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const cache = new Map()

/**
 * ALE-Bench tasks are the evaluators that open an ALE-Bench session.
 * Anything else, including the fixture evaluator, keeps the original loop.
 * @param {string} taskDir
 * @returns {Promise<{ ale: boolean, problemId: string | null }>}
 */
export async function taskKind(taskDir) {
  if (cache.has(taskDir)) return cache.get(taskDir)
  let text = ''
  try {
    text = await readFile(join(taskDir, 'evaluator', 'evaluator.py'), 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const match = text.match(/problem_id\s*=\s*["']([^"']+)["']/)
  const kind = {
    ale: text.includes('start_ale_bench_session'),
    problemId: match?.[1] ?? null,
  }
  cache.set(taskDir, kind)
  return kind
}

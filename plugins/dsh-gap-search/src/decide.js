import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../diagnostic/group.py', import.meta.url))

function runProcess(command, args, input, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { signal, windowsHide: true })
    const out = []
    const err = []
    child.stdout.on('data', chunk => out.push(chunk))
    child.stderr.on('data', chunk => err.push(chunk))
    child.on('error', reject)
    child.on('close', code => resolve({
      code: code ?? 1,
      stdout: Buffer.concat(out).toString('utf8'),
      stderr: Buffer.concat(err).toString('utf8'),
    }))
    child.stdin.end(input)
  })
}

/**
 * Ask group.py which classes are writable. The rows already carry features, failure, q, and gap.
 * @param {object[]} rows
 * @param {object} evolve
 * @returns {Promise<{ bins: object[], guard: number[] }>}
 */
export async function decide(rows, evolve) {
  let python = 'python'
  const subprocess = evolve.ctx?.get?.('subprocess')
  if (subprocess?.resolveExecutable) {
    python = await subprocess.resolveExecutable('python', undefined, evolve.currentRun().signal)
  }
  const result = await runProcess(python, ['-B', SCRIPT], JSON.stringify({ rows }), evolve.currentRun().signal)
  if (result.code !== 0) {
    throw new Error(`group.py failed (${result.code}): ${result.stderr.slice(-2000)}`)
  }
  const lines = result.stdout.trim().split(/\r?\n/)
  let line
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().startsWith('{')) {
      line = lines[index]
      break
    }
  }
  if (!line) throw new Error(`group.py returned no decision: ${result.stderr.slice(-500)}`)
  return JSON.parse(line)
}

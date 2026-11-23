/** Run files under run/gap/. Writes go through evolve.files, which fsyncs before rename. */

export const STATE_PATH = 'gap/state.json'
export const LOG_PATH = 'gap/log.jsonl'
export const SCALES_PATH = 'gap/scales.json'

export function profilePath(id) {
  return `gap/profiles/${id}.json`
}

export async function readState(files) {
  const text = await files.read(STATE_PATH)
  if (text === undefined) return undefined
  return JSON.parse(text)
}

export async function writeState(files, state) {
  await files.write(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`)
}

/**
 * Rebuild gap files from the evaluation that already happened.
 * A missing seed_profile is an error. The program is not run again.
 * @param {object} files
 * @param {object} population
 */
export async function ensureRecords(files, population) {
  const rows = await population.rows()
  for (const row of rows) {
    if (await files.exists(profilePath(row.id))) continue
    const raw = await files.read(`evals/${row.id}.json`)
    if (raw === undefined) {
      throw new Error(`gap profile for ${row.id} is missing and run/evals/${row.id}.json is missing; the program is not run again`)
    }
    const profile = JSON.parse(raw).metrics?.seed_profile
    if (!Array.isArray(profile?.rows) || profile.rows.length !== 50) {
      throw new Error(`gap profile for ${row.id} is missing and the stored evaluation has no 50-row seed_profile; the program is not run again`)
    }
    await files.write(profilePath(row.id), `${JSON.stringify(profile)}\n`)
  }
  let state = await readState(files)
  if (!state && rows.length > 0) {
    state = {
      writing_parent: rows[0].id,
      rejected: {},
      loose_ruler: false,
      reference_used: false,
    }
    await writeState(files, state)
  }
  return { rows, state }
}

/**
 * Freeze a supplied reference ruler the first time it is used.
 * Later incumbents do not rewrite it.
 * @param {object} files
 * @param {object} profile
 */
export async function rememberScales(files, profile) {
  if (!profile?.reference_used) return
  if (await files.exists(SCALES_PATH)) return
  await files.write(SCALES_PATH, `${JSON.stringify({
    source: 'reference_scores.json',
    problem_id: profile.problem_id,
    M: profile.rows.map(row => row.M),
  }, null, 2)}\n`)
}

export async function readProfile(files, id) {
  const text = await files.read(profilePath(id))
  if (text === undefined) {
    throw new Error(`writing parent ${id} has no gap profile; the program is not run again`)
  }
  return JSON.parse(text)
}

export async function loadEvalProfile(files, id) {
  const raw = await files.read(`evals/${id}.json`)
  if (raw === undefined) throw new Error(`evaluation for ${id} was not stored`)
  const profile = JSON.parse(raw).metrics?.seed_profile
  if (!Array.isArray(profile?.rows) || profile.rows.length !== 50) {
    throw new Error(`evaluation for ${id} has no 50-row seed_profile; the program is not run again`)
  }
  return profile
}

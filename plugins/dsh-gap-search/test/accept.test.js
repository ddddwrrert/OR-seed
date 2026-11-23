import assert from 'node:assert/strict'
import { test } from 'node:test'
import { judge } from '../src/accept.js'

function row(seed, gap, time, scale = 100) {
  return { seed, gap, scale, execution_time: time, q: gap === 0 ? 1 : 0.2, failure: gap === 0 ? null : 'unused_time' }
}

const bin = { id: 'unused_time|pets==20', seeds: [0, 1, 2], features: [{ token: 'pets', threshold: 20 }] }
const before = `#EVOLVE_START
int main(){return 0;}
#EVOLVE_END
`
const after = `#EVOLVE_START
int pets = 20;
if (pets == 20) {}
int main(){return 0;}
#EVOLVE_END
`

test('δ and a rising clock accept one heavier-search edit', () => {
  const parent = [0, 1, 2].map(seed => row(seed, 80, 0.2)).concat([row(3, 0, 0.2)])
  const child = [0, 1, 2].map(seed => row(seed, 70, 1.0)).concat([row(3, 0, 0.2)])
  const verdict = judge({
    parentRows: parent,
    childRows: child,
    bin,
    guard: [3],
    mechanism: 'heavier-search',
    before,
    after,
    limit: 2,
  })
  assert.equal(verdict.ok, true)
  assert.equal(verdict.deltas.length, 4)
  assert.ok(verdict.mean_delta > 0.05)
})

test('a comment that mentions time does not move the clock', () => {
  const parent = [0, 1, 2].map(seed => row(seed, 80, 0.2)).concat([row(3, 0, 0.2)])
  const child = [0, 1, 2].map(seed => row(seed, 70, 0.2)).concat([row(3, 0, 0.2)])
  const timed = `#EVOLVE_START
int pets = 20;
if (pets == 20) {}
// spend more time
int main(){return 0;}
#EVOLVE_END
`
  const verdict = judge({
    parentRows: parent,
    childRows: child,
    bin,
    guard: [3],
    mechanism: 'heavier-search',
    before,
    after: timed,
    limit: 2,
  })
  assert.equal(verdict.ok, false)
  assert.ok(verdict.reasons.includes('time-not-up'))
})

test('the guard rejects a bulk drop and a bulk increase in time', () => {
  const parent = [0, 1, 2].map(seed => row(seed, 80, 0.2)).concat([3, 4, 5].map(seed => row(seed, 0, 0.2)))
  const child = [0, 1, 2].map(seed => row(seed, 70, 1.0)).concat([3, 4, 5].map(seed => row(seed, 40, 1.2)))
  const verdict = judge({
    parentRows: parent,
    childRows: child,
    bin,
    guard: [3, 4, 5],
    mechanism: 'heavier-search',
    before,
    after,
    limit: 2,
  })
  assert.equal(verdict.ok, false)
  assert.ok(verdict.reasons.includes('guard-given-back'))
  assert.ok(verdict.reasons.includes('guard-time-rose'))
})

test('a pegged run may keep the same clock when the gap shrinks', () => {
  const stuck = { ...bin, failure: 'time_exhausted' }
  const parent = [0, 1, 2].map(seed => row(seed, 80, 1.9))
  const child = [0, 1, 2].map(seed => row(seed, 70, 1.9))
  const verdict = judge({
    parentRows: parent,
    childRows: child,
    bin: stuck,
    guard: [],
    mechanism: 'cheaper-step',
    before,
    after,
    limit: 2,
  })
  assert.equal(verdict.ok, true)
  assert.equal(verdict.time.check, 'capped-not-longer')
})

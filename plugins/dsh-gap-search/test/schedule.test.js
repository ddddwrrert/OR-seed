import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dropMechanism, nextMechanism, pick, timeDirection } from '../src/schedule.js'

test('one failure queue emits one name, then the next after a rejection', () => {
  const bin = { id: 'search_stuck|pets>15', failure: 'search_stuck' }
  assert.equal(nextMechanism(bin, {}), 'construction')
  const once = dropMechanism({}, bin.id, 'construction')
  assert.equal(nextMechanism(bin, once), 'neighborhood')
  const twice = dropMechanism(once, bin.id, 'neighborhood')
  assert.equal(nextMechanism(bin, twice), null)
  assert.deepEqual(pick([bin], twice), null)
})

test('a later class is used when the first queue is empty', () => {
  const first = { id: 'a', failure: 'unused_time', gap: 10 }
  const second = { id: 'b', failure: 'invalid', gap: 3 }
  const rejected = dropMechanism({}, 'a', 'heavier-search')
  assert.deepEqual(pick([first, second], rejected), { bin: second, mechanism: 'state-invariant' })
})

test('clock direction follows the mechanism', () => {
  assert.equal(timeDirection('heavier-search'), 'rise')
  assert.equal(timeDirection('cheaper-step'), 'fall')
  assert.equal(timeDirection('focus-state'), 'fall')
  assert.equal(timeDirection('construction'), 'none')
  assert.equal(timeDirection('neighborhood'), 'none')
  assert.equal(timeDirection('state-invariant'), 'none')
})

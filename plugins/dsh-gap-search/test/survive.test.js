import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keptIds } from '../src/survive.js'

test('the writing parent and the official best stay even past k', () => {
  const rows = [
    { id: 'c000000', fitness: 10, survival: 'yes' },
    { id: 'c000001', fitness: 50, survival: 'yes' },
    { id: 'c000002', fitness: 40, survival: 'yes' },
    { id: 'c000003', fitness: 1, survival: 'no' },
  ]
  const kept = keptIds(rows, 1, 'c000000')
  assert.equal(kept.has('c000000'), true)
  assert.equal(kept.has('c000001'), true)
  assert.equal(kept.has('c000002'), false)
  assert.equal(kept.has('c000003'), false)
})

test('a dead writing parent is not resurrected', () => {
  const rows = [
    { id: 'c000000', fitness: 10, survival: 'no' },
    { id: 'c000001', fitness: 4, survival: 'yes' },
  ]
  const kept = keptIds(rows, 5, 'c000000')
  assert.equal(kept.has('c000000'), false)
  assert.equal(kept.has('c000001'), true)
})

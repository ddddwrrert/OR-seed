import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../src/index.js'

test('the plugin replaces four slots and leaves evaluate alone', () => {
  const slots = []
  const ctx = {
    evolve: {
      register(slot) {
        slots.push(slot)
        return () => {}
      },
    },
    effect(start) {
      start()
    },
  }
  apply(ctx)
  assert.deepEqual(slots, ['loop', 'select', 'mutate', 'survive'])
})

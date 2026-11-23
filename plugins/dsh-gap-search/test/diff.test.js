import assert from 'node:assert/strict'
import { test } from 'node:test'
import { editShape } from '../src/diff.js'

const before = `#EVOLVE_START
int main(){return 0;}
#EVOLVE_END
`

const bin = {
  seeds: [3, 7],
  features: [{ token: 'pets', threshold: 20, op: '==' }],
}

test('one block that names the input quantity passes', () => {
  const after = `#EVOLVE_START
int pets = 20;
if (pets == 20) {}
int main(){return 0;}
#EVOLVE_END
`
  assert.equal(editShape(before, after, bin, 'heavier-search'), null)
})

test('two separated additions are two edits', () => {
  const source = `#EVOLVE_START
int a = 1;
int b = 2;
#EVOLVE_END
`
  const after = `#EVOLVE_START
int a = 1;
int pets = 20;
int b = 2;
if (pets == 20) {}
#EVOLVE_END
`
  assert.equal(editShape(source, after, bin, 'heavier-search'), 'two-regions')
})

test('the word seed rejects the block', () => {
  const after = `#EVOLVE_START
int pets = 20;
if (pets == 20 && seed == 3) {}
int main(){return 0;}
#EVOLVE_END
`
  assert.equal(editShape(before, after, bin, 'construction'), 'seed-word')
})

test('a case number on a line without the input quantity rejects the block', () => {
  const after = `#EVOLVE_START
if (id == 3) {}
int pets = 20;
if (pets == 20) {}
int main(){return 0;}
#EVOLVE_END
`
  assert.equal(editShape(before, after, bin, 'construction'), 'seed-index')
})

test('a penalty assignment is not a state change', () => {
  const after = `#EVOLVE_START
penalty = 3;
int main(){return 0;}
#EVOLVE_END
`
  assert.equal(editShape(before, after, { seeds: [], features: [] }, 'state-invariant'), 'penalty-only')
})

test('code outside the markers is rejected', () => {
  const after = `int leaked = 1;
#EVOLVE_START
int pets = 20;
if (pets == 20) {}
int main(){return 0;}
#EVOLVE_END
`
  assert.equal(editShape(before, after, bin, 'heavier-search'), 'outside-markers')
})

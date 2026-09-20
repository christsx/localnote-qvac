import assert from 'node:assert/strict'
import test from 'node:test'

import { createHistory, OPERATIONS } from '../src/prompts.js'

test('all three operations are configured', () => {
  assert.deepEqual(Object.keys(OPERATIONS), ['summarize', 'cleanup', 'actions'])
})

test('history includes the note and anti-invention guidance', () => {
  const history = createHistory('actions', 'Jason should test checkout.')
  assert.equal(history.length, 2)
  assert.match(history[0].content, /Never introduce facts/)
  assert.match(history[1].content, /Jason should test checkout/)
  assert.match(history[1].content, /Do not invent tasks/)
})

test('empty notes and invalid operations are rejected', () => {
  assert.throws(() => createHistory('summarize', '  '), /Enter a note/)
  assert.throws(() => createHistory('unknown', 'hello'), /Unknown operation/)
})

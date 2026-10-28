'use strict';
// chain.yml reading with defaults (used by scan and by the endpoint).
const test = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../lib/config');

const repo = (text) => ({ files: text === null ? [] : ['chain.yml'], read: async () => text });

test('defaults when chain.yml is absent', async () => {
  assert.deepEqual(await readConfig(repo(null)), { paths: { capabilities: 'capabilities', intent: 'intent' }, health: { stale_days: 7 } });
});

test('reads paths and stale_days', async () => {
  const c = await readConfig(repo('paths:\n  intent: ./work/\nhealth:\n  stale_days: 14\n'));
  assert.deepEqual(c, { paths: { capabilities: 'capabilities', intent: 'work' }, health: { stale_days: 14 } });
});

test('invalid values fall back to defaults', async () => {
  const c = await readConfig(repo('health:\n  stale_days: -3\npaths: nope\n'));
  assert.deepEqual(c, { paths: { capabilities: 'capabilities', intent: 'intent' }, health: { stale_days: 7 } });
  assert.deepEqual(await readConfig(repo('{ broken')), await readConfig(repo(null)));
});

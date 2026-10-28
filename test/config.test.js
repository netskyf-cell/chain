'use strict';
// chain.yml reading with defaults (used by scan and by the endpoint).
const test = require('node:test');
const assert = require('node:assert/strict');
const { readConfig, withDefaults, DEFAULTS } = require('../lib/config');

const REST = { review: DEFAULTS.review, light: DEFAULTS.light };

const repo = (text) => ({ files: text === null ? [] : ['chain.yml'], read: async () => text });

test('defaults when chain.yml is absent', async () => {
  assert.deepEqual(await readConfig(repo(null)), { paths: { capabilities: 'capabilities', intent: 'intent' }, health: { stale_days: 7 }, ...REST });
});

test('reads paths and stale_days', async () => {
  const c = await readConfig(repo('paths:\n  intent: ./work/\nhealth:\n  stale_days: 14\n'));
  assert.deepEqual(c, { paths: { capabilities: 'capabilities', intent: 'work' }, health: { stale_days: 14 }, ...REST });
});

test('invalid values fall back to defaults', async () => {
  const c = await readConfig(repo('health:\n  stale_days: -3\npaths: nope\n'));
  assert.deepEqual(c, { paths: { capabilities: 'capabilities', intent: 'intent' }, health: { stale_days: 7 }, ...REST });
  assert.deepEqual(await readConfig(repo('{ broken')), await readConfig(repo(null)));
});

test('S2: reads review passes, drift passes and light thresholds', async () => {
  const c = await readConfig(repo('review:\n  passes: [bugs, Compliance, style]\n  drift_passes: [compliance, style]\nlight:\n  max_files: 8\n  max_changed_lines: 300\n'));
  assert.deepEqual(c.review, { passes: ['bugs', 'compliance', 'style'], drift_passes: ['compliance', 'style'] });
  assert.deepEqual(c.light, { max_files: 8, max_changed_lines: 300 });
});

test('S2: drift passes must be review passes; bad values fall back', async () => {
  const c = await readConfig(repo('review:\n  passes: [bugs]\n  drift_passes: [compliance]\nlight:\n  max_files: zero\n'));
  assert.deepEqual(c.review, { passes: ['bugs'], drift_passes: [] });
  assert.deepEqual(c.light, DEFAULTS.light);
  assert.deepEqual(withDefaults(undefined).review, DEFAULTS.review);
});

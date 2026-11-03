'use strict';
// Plan P2: facts shown next to drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../lib/engine');
const { example, config, item } = require('./helpers');

const facts = (obs = example(), cfg = config()) => run(obs, cfg).facts;

test('decisions are grouped across tools and say where they started', () => {
  const [maintenance, driver] = facts().decisions;
  assert.equal(driver.id, 'wiki:9001');
  assert.deepEqual(driver.startedIn, { source: 'wiki', item: 'wiki:9001', at: '2026-08-25T08:00:00Z' });
  assert.deepEqual(driver.items, ['wiki:9001', 'ado:100', 'ado:110', 'ado:111', 'ado:112', 'ado:113']);
  assert.equal(maintenance.id, 'ado:200');
  assert.equal(maintenance.startedIn.source, 'ado');
});

test('path across tools lists each tool once per step, in time order', () => {
  const [maintenance, driver] = facts().decisions;
  assert.deepEqual(driver.path, ['wiki', 'ado', 'gh']);
  assert.deepEqual(maintenance.path, ['ado']);
});

test('started in moves when the Epic predates the page', () => {
  const obs = example();
  item(obs, 'ado:100').createdAt = '2026-08-01T00:00:00Z';
  const driver = facts(obs).decisions.find((d) => d.items.includes('ado:100'));
  assert.equal(driver.startedIn.source, 'ado');
  assert.deepEqual(driver.path, ['ado', 'wiki', 'ado', 'gh']);
});

test('where built and agent share per decision', () => {
  const driver = facts().decisions.find((d) => d.id === 'wiki:9001');
  assert.deepEqual(driver.changes, ['gh:41', 'gh:43']);
  assert.deepEqual(driver.builtIn, [{ source: 'gh', repository: 'example/fleet-portal' }]);
  assert.deepEqual(driver.commits, { agent: 2, person: 1, unknown: 0 });
  assert.equal(driver.agentSharePercent, 67);
});

test('a decision with no change has no agent share', () => {
  const maintenance = facts().decisions.find((d) => d.id === 'ado:200');
  assert.equal(maintenance.agentSharePercent, null);
  assert.deepEqual(maintenance.changes, []);
});

test('per change: authorship, where the agent ran, and who checked it', () => {
  assert.deepEqual(
    facts().changes.map((c) => [c.id, c.authorship, c.ranOn, c.checkedByPerson, c.checkedByCompliance]),
    [
      ['gh:41', 'mixed', 'local', true, true],
      ['gh:42', 'person', null, false, false],
      ['gh:43', 'agent', 'cloud', false, false],
    ],
  );
});

test('team totals', () => {
  assert.deepEqual(facts().team, {
    mergedChanges: 3,
    byAuthorship: { person: 1, agent: 1, mixed: 1, unknown: 0 },
    commits: { agent: 2, person: 2, unknown: 0 },
    agentSharePercent: 50,
    checkedByPerson: 1,
    checkedByCompliance: 1,
  });
});

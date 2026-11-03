'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateObservations, validateConfig, readJson, readYaml } = require('../lib/validate');

const examples = path.join(__dirname, '..', 'examples');
const example = () => readJson(path.join(examples, 'observations.example.json'));
const config = () => readYaml(path.join(examples, 'chain.example.yml'));

test('every example observations file is valid', () => {
  for (const f of fs.readdirSync(examples).filter((x) => x.endsWith('.json'))) {
    assert.deepEqual(validateObservations(readJson(path.join(examples, f))), [], f);
  }
});

test('the example chain.yml is valid', () => {
  assert.deepEqual(validateConfig(config()), []);
});

test('example sources match the example chain.yml', () => {
  const fromConfig = config().sources.map((s) => s.id).sort();
  const fromObs = example().sources.map((s) => s.id).sort();
  assert.deepEqual(fromObs, fromConfig);
});

test('a 0.1 file is rejected', () => {
  const data = example();
  data.contract = 'chain.observations/0.1';
  assert.notDeepEqual(validateObservations(data), []);
});

test('collector-written judgements are rejected (ADR-0001)', () => {
  for (const field of ['authorKind', 'agent', 'divergences']) {
    const data = example();
    data.items.find((i) => i.role === 'change').change[field] = 'x';
    assert.notDeepEqual(validateObservations(data), [], field);
  }
  const data = example();
  data.items.find((i) => i.id === 'gh:41').change.reviews[0].findings = [];
  assert.notDeepEqual(validateObservations(data), [], 'findings');
});

test('a change must carry raw commits and reviews', () => {
  const data = example();
  delete data.items.find((i) => i.id === 'gh:42').change.commits;
  assert.notDeepEqual(validateObservations(data), []);
});

test('commits may be null when they could not be read', () => {
  const data = example();
  data.items.find((i) => i.id === 'gh:42').change.commits = null;
  assert.deepEqual(validateObservations(data), []);
});

test('a link to an item outside the file is reported', () => {
  const data = example();
  data.items.find((i) => i.id === 'gh:41').links.push({ to: 'ado:999', via: 'ab-mention' });
  assert.deepEqual(validateObservations(data), ['gh:41: link to ado:999, which is not in the file']);
});

test('a duplicate id is reported', () => {
  const data = example();
  data.items.push({ ...data.items[0] });
  assert.ok(validateObservations(data).includes('duplicate item id: wiki:9001'));
});

test('an item whose source is not listed is reported', () => {
  const data = example();
  data.sources = data.sources.filter((s) => s.id !== 'wiki');
  assert.ok(validateObservations(data).some((p) => p.includes('source "wiki" is not in sources')));
});

test('a role mapped to an unknown source is reported', () => {
  const data = config();
  data.roles.plan.push({ source: 'jira', type: 'Story' });
  assert.deepEqual(validateConfig(data), ['roles.plan: source "jira" is not in sources']);
});

test('the example has one case per rule and per fact (contract README)', () => {
  const data = example();
  const byId = Object.fromEntries(data.items.map((i) => [i.id, i]));
  // Done without proof: a done plan item that no merged change links to.
  const linked = new Set(data.items.filter((i) => i.change?.merged).flatMap((i) => i.links.map((l) => l.to)));
  assert.equal(byId['ado:112'].state, 'done');
  assert.ok(!linked.has('ado:112'));
  // Change without a mandate.
  assert.deepEqual(byId['gh:42'].links, []);
  // Out of order.
  assert.equal(byId['ado:113'].state, 'open');
  assert.ok(linked.has('ado:113'));
  // Moved goalposts.
  assert.ok(byId['ado:110'].criteria[2].changedAt > byId['gh:41'].change.mergedAt);
  // Declared divergence and a parseable compliance finding live in raw text.
  assert.match(byId['gh:41'].change.body, /## Divergences from plan/);
  assert.match(byId['gh:41'].change.reviews[0].body, /^\[compliance\] Important:/m);
  // Agent change, no person reviewed: bot author, only a tagged comment.
  assert.equal(byId['gh:43'].change.author.isBot, true);
  // Started in: the wiki page predates the Epic it links to.
  assert.ok(byId['wiki:9001'].createdAt < byId['ado:100'].createdAt);
  // Mixed authorship: one commit with an agent trailer, one without.
  assert.deepEqual(byId['gh:41'].change.commits.map((c) => c.trailers.length), [1, 0]);
});

'use strict';
// Spec AC-E1 to AC-E7: each rule raised once and not raised once, pure and
// repeatable, "not checked" instead of guessing, evidence on every verdict.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { run, toJson } = require('../lib/engine');
const { RULES } = require('../lib/rules');
const { example, config, item, root } = require('./helpers');

const signals = (obs, cfg = config()) => run(obs, cfg).signals;
const raised = (obs, rule, cfg) => signals(obs, cfg).filter((s) => s.rule === rule).map((s) => s.items.join(' '));

// AC-E7: the example gives exactly the verdicts in the contract README.
test('the example gives exactly the documented verdicts', () => {
  assert.deepEqual(
    signals(example()).map((s) => `${s.rule} ${s.items.join(' ')}`),
    [
      'done-without-proof ado:112',
      'change-without-mandate gh:42',
      'out-of-order gh:43 ado:113',
      'moved-goalposts ado:110 gh:41',
      'stalled-intent ado:200',
      'criterion-not-met gh:41',
      'unverified gh:42',
      'unverified gh:43',
      'declared-divergence gh:41',
      'agent-no-person-review gh:43',
    ],
  );
});

test('there are nine rules, each with an id, name, kind and needs', () => {
  assert.equal(RULES.length, 9);
  for (const r of RULES) {
    assert.ok(r.id && r.name && ['traceability', 'content'].includes(r.kind), r.id);
    assert.ok(Array.isArray(r.needs.block) && Array.isArray(r.needs.note), r.id);
  }
});

// AC-E1: one "not raised" case per rule (the "raised" case is the example).
test('done without proof: not raised once a merged change links to the item', () => {
  const obs = example();
  item(obs, 'gh:41').links.push({ to: 'ado:112', via: 'ab-mention' });
  assert.deepEqual(raised(obs, 'done-without-proof'), []);
});

test('done without proof: an unmerged change is not proof', () => {
  const obs = example();
  const gh41 = item(obs, 'gh:41');
  gh41.links.push({ to: 'ado:112', via: 'ab-mention' });
  gh41.change.merged = false;
  assert.ok(raised(obs, 'done-without-proof').includes('ado:112'));
});

test('change without a mandate: a link to a spec counts (spec D3)', () => {
  const obs = example();
  item(obs, 'gh:42').links.push({ to: 'ado:110', via: 'url' });
  assert.deepEqual(raised(obs, 'change-without-mandate'), []);
});

test('out of order: not raised once the plan item is active', () => {
  const obs = example();
  item(obs, 'ado:113').state = 'active';
  assert.deepEqual(raised(obs, 'out-of-order'), []);
});

test('moved goalposts: not raised when criteria changed before the merge', () => {
  const obs = example();
  item(obs, 'ado:110').criteria[2].changedAt = '2026-10-01T00:00:00Z';
  assert.deepEqual(raised(obs, 'moved-goalposts'), []);
});

test('moved goalposts: unknown change dates never raise', () => {
  const obs = example();
  item(obs, 'ado:110').criteria[2].changedAt = null;
  assert.deepEqual(raised(obs, 'moved-goalposts'), []);
});

test('stalled intent: not raised within stalled_after_days, raised after', () => {
  const obs = example();
  const cfg = config();
  cfg.rules.stalled_after_days = 200;
  assert.deepEqual(raised(obs, 'stalled-intent', cfg), []);
  cfg.rules.stalled_after_days = 2;
  assert.deepEqual(raised(obs, 'stalled-intent', cfg), ['ado:100', 'ado:200', 'wiki:9001'], 'gh:43 merged 2 days before collection');
});

test('stalled intent: the wiki PRD linked to the Epic shares its changes', () => {
  const cfg = config();
  cfg.rules.stalled_after_days = 10;
  assert.ok(!raised(example(), 'stalled-intent', cfg).includes('wiki:9001'), 'gh:43 merged 2 days before collection');
});

test('criterion not met: not raised once a later review says Met', () => {
  const obs = example();
  item(obs, 'gh:41').change.reviews.push({
    at: '2026-10-21T07:00:00Z', url: 'https://github.com/example/fleet-portal/pull/41#issuecomment-9',
    author: { login: 'sam', name: 'Sam', isBot: false }, state: null,
    body: '[compliance] Met: AC-1 CSV download\n[compliance] Met: AC-2 date range now applied',
  });
  assert.deepEqual(raised(obs, 'criterion-not-met'), []);
  assert.ok(!raised(obs, 'unverified').includes('gh:41'));
});

test('unverified: not raised when a compliance verdict exists', () => {
  const obs = example();
  item(obs, 'gh:43').change.reviews[0].body = '[compliance] Met: AC-1 export logged';
  assert.deepEqual(raised(obs, 'unverified'), ['gh:42']);
});

test('declared divergence: "None" declares nothing', () => {
  const obs = example();
  item(obs, 'gh:41').change.body = 'AB#111\n\n## Divergences from plan\n\nNone.\n';
  assert.deepEqual(raised(obs, 'declared-divergence'), []);
});

test('agent change, no person reviewed: not raised after a person approves', () => {
  const obs = example();
  item(obs, 'gh:43').change.reviews.push({
    at: '2026-10-31T08:00:00Z', url: 'https://github.com/example/fleet-portal/pull/43#pullrequestreview-4',
    author: { login: 'lee', name: 'Lee', isBot: false }, state: 'approved', body: '',
  });
  assert.deepEqual(raised(obs, 'agent-no-person-review'), []);
});

test('agent change, no person reviewed: a mixed change counts too', () => {
  const obs = example();
  item(obs, 'gh:41').change.reviews.pop();
  assert.deepEqual(raised(obs, 'agent-no-person-review'), ['gh:41', 'gh:43']);
});

// AC-E5: missing data is not drift.
test('an unread code host blocks the rules that need every change, and is reported', () => {
  const obs = example();
  Object.assign(obs.sources.find((s) => s.id === 'adorepos'), { read: false, reason: 'No connector.' });
  const result = run(obs, config());
  const rules = result.signals.map((s) => s.rule);
  assert.ok(!rules.includes('done-without-proof'));
  assert.ok(!rules.includes('stalled-intent'));
  assert.ok(rules.includes('unverified'), 'per-change rules still run on what was read');
  const blocked = result.notChecked.filter((n) => n.skipped).map((n) => n.rule);
  assert.deepEqual(blocked, ['done-without-proof', 'stalled-intent']);
  assert.ok(result.notChecked.find((n) => n.rule === 'unverified' && !n.skipped && n.sources.includes('adorepos')));
});

test('a partly read tracker blocks the mandate and order rules', () => {
  const obs = example();
  Object.assign(obs.sources.find((s) => s.id === 'ado'), { partial: true, reason: 'Stopped at 500 items.' });
  const blocked = run(obs, config()).notChecked.filter((n) => n.skipped).map((n) => n.rule);
  assert.deepEqual(blocked, ['change-without-mandate', 'out-of-order']);
});

test('without chain.yml, code hosts feed changes and the rest feed decisions', () => {
  const obs = example();
  Object.assign(obs.sources.find((s) => s.id === 'gh'), { read: false });
  const blocked = run(obs, null).notChecked.filter((n) => n.skipped).map((n) => n.rule);
  assert.deepEqual(blocked, ['done-without-proof', 'stalled-intent']);
});

// AC-E6: every verdict names its rule, its items and a URL to evidence.
test('every verdict has a rule, a name, items and evidence with a URL', () => {
  for (const s of signals(example())) {
    assert.ok(s.rule && s.name && s.items.length && s.message, s.rule);
    assert.ok(s.evidence.length && s.evidence.every((e) => /^https?:\/\//.test(e.url)), s.rule);
  }
});

// AC-E2: pure and repeatable.
test('same input, byte-identical output; inputs are not changed', () => {
  const obs = example();
  const before = JSON.stringify(obs);
  const first = toJson(run(obs, config()));
  assert.equal(toJson(run(example(), config())), first);
  assert.equal(JSON.stringify(obs), before);
});

test('item order in the file does not change the verdicts', () => {
  const obs = example();
  obs.items.reverse();
  assert.equal(toJson(run(obs, config())), toJson(run(example(), config())));
});

test('the rules engine reads no clock, network, randomness or model (ADR-0001)', () => {
  const dirs = ['lib/rules', 'lib/facts'].map((d) => path.join(root, d));
  const files = [...dirs.flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f))), path.join(root, 'lib/engine.js'), path.join(root, 'lib/authorship.js')];
  const banned = /Date\.now|new Date\(\)|Math\.random|require\(['"](node:)?(https?|net|child_process|fs)['"]\)|fetch\(/;
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), banned, path.relative(root, f));
});

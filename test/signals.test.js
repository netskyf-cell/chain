'use strict';
// AC-3 to AC-7 (S2): the seven drift signals, their supersession, shape and health.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { reconcile } = require('../lib/reconcile/state');

const S = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'drift', 'scenario.json'), 'utf8'));
const CONFIG = {
  health: { stale_days: 7 },
  review: { passes: ['bugs', 'security', 'compliance'], drift_passes: ['compliance'] },
  light: { max_files: 5, max_changed_lines: 150 },
};

function run(over = {}) {
  return reconcile({
    model: S.model,
    prs: { open: over.open || S.open, merged: over.merged || S.merged, partial: false },
    history: over.history || S.history,
    config: CONFIG,
    now: S.now,
  });
}

const sigs = (r, where) => r.signals.filter((s) => (where.feature ? s.feature === where.feature : s.pr === where.pr));
const kinds = (list) => list.map((s) => s.kind);
const feature = (r, slug) => r.features.find((f) => f.slug === slug);

test('intent_rework: intent changed after the spec started', () => {
  const r = run();
  const list = sigs(r, { feature: 'ir' });
  assert.deepEqual(kinds(list), ['intent_rework']);
  assert.equal(list[0].evidence.ref, 'i2');
  assert.equal(list[0].severity, 'warn');
});

test('intent_rework near miss: superseded when the spec changed afterwards', () => {
  assert.deepEqual(kinds(sigs(run(), { feature: 'ir-ok' })), []);
});

test('intent_rework when the spec predates the history window', () => {
  assert.deepEqual(kinds(sigs(run(), { feature: 'ir-old' })), ['intent_rework']);
});

test('no rework signal when the history is partial', () => {
  assert.deepEqual(kinds(sigs(run(), { feature: 'ir-partial' })), []);
});

test('spec_rework: spec changed after the plan started', () => {
  const list = sigs(run(), { feature: 'sr' });
  assert.deepEqual(kinds(list), ['spec_rework']);
  assert.equal(list[0].evidence.ref, 'r2');
});

test('pr_declares_divergence on a merged PR, until the plan absorbs it', () => {
  const r = run();
  const dv = sigs(r, { feature: 'dv' });
  assert.deepEqual(kinds(dv), ['pr_declares_divergence']);
  assert.equal(dv[0].evidence.ref, 31);
  assert.match(dv[0].message, /Skipped step 3/);
  assert.deepEqual(kinds(sigs(r, { feature: 'dv-ok' })), [], 'plan updated after PR #32 merged; PR #33 says None');
});

test('plan_revised is information only and does not change health', () => {
  const r = run();
  assert.deepEqual(kinds(sigs(r, { feature: 'pv' })), ['plan_revised']);
  assert.equal(sigs(r, { feature: 'pv' })[0].severity, 'info');
  assert.equal(feature(r, 'pv').health.status, 'on track');
});

test('compliance_finding: Important and Block [compliance] findings only, from reviews and inline comments', () => {
  const list = sigs(run(), { feature: 'cf' });
  assert.deepEqual(list.map((s) => [s.kind, s.severity, s.evidence.type]), [
    ['compliance_finding', 'high', 'comment'],
    ['compliance_finding', 'high', 'review'],
  ]);
  assert.match(list[0].message, /Non-goals/);
  assert.match(list[1].message, /AC-3 not met/);
});

test('gate_bypassed: a commit contained in no PR; unchecked commits are not flagged', () => {
  const list = sigs(run(), { feature: 'gb' });
  assert.deepEqual(list.map((s) => [s.kind, s.severity, s.evidence.ref]), [['gate_bypassed', 'high', 'g1']]);
});

test('light_path_large: attached to the PR, not a feature', () => {
  const r = run();
  const list = sigs(r, { pr: 36 });
  assert.deepEqual(list.map((s) => [s.kind, s.feature]), [['light_path_large', null]]);
  assert.match(list[0].message, /6 files/);
  assert.deepEqual(sigs(r, { pr: 37 }), [], '1 file and 10 lines is within the guard');
});

test('AC-5: every signal has kind, severity, rule, message and evidence with type, url, time', () => {
  for (const s of run().signals) {
    for (const key of ['kind', 'severity', 'rule', 'message']) assert.ok(s[key], `${s.kind} lacks ${key}`);
    assert.ok(['commit', 'pr', 'review', 'comment'].includes(s.evidence.type));
    assert.match(s.evidence.url, /^https:\/\//);
    assert.ok(!Number.isNaN(Date.parse(s.evidence.at)));
  }
});

test('AC-6: health is drift with the most severe, then most recent, signal as reason', () => {
  const r = run();
  assert.equal(feature(r, 'cf').health.status, 'drift');
  assert.match(feature(r, 'cf').health.reason, /Non-goals/, 'the Block comment (newer) wins over the review');
  assert.deepEqual(feature(r, 'ir').health.status, 'drift');
  assert.equal(feature(r, 'ir-ok').health.status, 'on track');
});

test('AC-6: drift is checked before blocked', () => {
  const stale = { ...S.open[1], updatedAt: '2026-10-01T10:00:00Z', files: [{ path: 'intent/cf/spec.md', status: 'modified', additions: 1, deletions: 1 }] };
  const r = run({ open: [stale] });
  assert.equal(feature(r, 'cf').health.status, 'drift');
});

test('AC-7: deterministic, signal time is the evidence time, inputs not mutated', () => {
  const before = JSON.stringify(S);
  const a = run();
  const b = run();
  assert.deepEqual(a.signals, b.signals);
  assert.equal(JSON.stringify(S), before);
  assert.ok(a.signals.every((s) => s.evidence.at !== S.now));
});

test('without history or findings, S1a behaviour is unchanged (no signals)', () => {
  const r = reconcile({ model: S.model, prs: { open: [], merged: [], partial: false }, config: CONFIG, now: S.now });
  assert.deepEqual(r.signals, []);
  assert.ok(r.features.every((f) => f.health.status === 'on track'));
});

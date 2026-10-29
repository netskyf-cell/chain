'use strict';
// AC-7 (S1b): failing checks block a feature, after changes requested, before inactivity.
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcile, failingChecks } = require('../lib/reconcile/state');

const NOW = '2026-10-29T12:00:00Z';
const model = {
  paths: { capabilities: 'capabilities', intent: 'intent' },
  capabilities: [],
  unassigned: [],
  empty: false,
  features: [{ slug: 'x', capability: null, artifacts: {
    intent: { state: 'present', path: 'intent/x/intent.md' },
    spec: { state: 'absent', path: 'intent/x/spec.md' },
    plan: { state: 'absent', path: 'intent/x/plan.md' } } }],
};
const pr = (extra) => ({
  number: 5, title: 'Spec x', url: 'https://github.com/o/r/pull/5', author: 'a',
  createdAt: '2026-10-28T10:00:00Z', updatedAt: '2026-10-28T10:00:00Z', mergedAt: null, draft: false,
  body: '', labels: [], requestedReviewers: [], files: [{ path: 'intent/x/spec.md', status: 'added', additions: 5, deletions: 0 }],
  reviews: [], comments: [], headSha: 'h1', checks: null, ...extra,
});
const health = (p) => reconcile({ model, prs: { open: [p], merged: [] }, config: {}, now: NOW }).features[0].health;

test('failing check runs and error statuses are named, sorted', () => {
  assert.deepEqual(failingChecks({
    runs: [{ name: 'lint', conclusion: 'success' }, { name: 'test', conclusion: 'failure' }, { name: 'e2e', conclusion: 'timed_out' }, { name: 'slow', conclusion: null }],
    statuses: [{ context: 'ci/old', state: 'error' }, { context: 'ci/ok', state: 'success' }, { context: 'ci/pending', state: 'pending' }],
  }), ['ci/old', 'e2e', 'test']);
  assert.deepEqual(failingChecks(null), []);
});

test('AC-7: an artifact PR with a failing check is blocked with the check names', () => {
  assert.deepEqual(health(pr({ checks: { runs: [{ name: 'test', status: 'completed', conclusion: 'cancelled' }], statuses: [] } })),
    { status: 'blocked', reason: 'PR #5 has failing checks (test)' });
});

test('AC-7: changes requested wins over failing checks; failing checks win over inactivity', () => {
  const failing = { runs: [{ name: 'test', conclusion: 'failure' }], statuses: [] };
  const withReview = pr({ checks: failing, reviews: [{ user: 'r', state: 'CHANGES_REQUESTED', submittedAt: '2026-10-28T11:00:00Z' }] });
  assert.match(health(withReview).reason, /changes requested/);
  const stale = pr({ checks: failing, updatedAt: '2026-10-01T10:00:00Z' });
  assert.match(health(stale).reason, /failing checks/);
});

test('passing, pending or unread checks do not block; the PR carries its checks state', () => {
  const r = (checks) => reconcile({ model, prs: { open: [pr({ checks })], merged: [] }, config: {}, now: NOW });
  assert.equal(r({ runs: [{ name: 't', conclusion: 'success' }], statuses: [] }).features[0].health.status, 'on track');
  assert.equal(r({ runs: [{ name: 't', conclusion: 'success' }], statuses: [] }).prs[0].checksState, 'passing');
  assert.equal(r({ runs: [{ name: 't', conclusion: 'failure' }], statuses: [] }).prs[0].checksState, 'failing');
  assert.equal(r(null).prs[0].checksState, 'none');
  assert.equal(r(null).features[0].health.status, 'on track');
});

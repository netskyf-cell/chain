'use strict';
// AC-2 to AC-9: reconcile() — artifact state, linking, lifecycle, health, queue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scan } = require('../lib/scan');
const { reconcile } = require('../lib/reconcile/state');
const { fixtureRepo } = require('./helpers');

const PRS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'prs', 'conventional.json'), 'utf8'));
const CONFIG = { health: { stale_days: 7 } };

async function run(prs = PRS, config = CONFIG, now = PRS.now) {
  const model = await scan(fixtureRepo('conventional'));
  return reconcile({ model, prs: { open: prs.open, merged: prs.merged, partial: prs.partial }, config, now });
}

const byslug = (r) => Object.fromEntries(r.features.map((f) => [f.slug, f]));
const states = (f) => ['intent', 'spec', 'plan'].map((s) => f.artifacts[s].state).join(' ');

test('AC-2: artifact states (accepted, revising, proposed, absent)', async () => {
  const f = byslug(await run());
  assert.equal(states(f.full), 'accepted revising accepted');
  assert.equal(states(f['intent-only']), 'revising proposed absent');
  assert.equal(states(f['no-frontmatter']), 'accepted accepted absent');
  assert.equal(states(f.orphan), 'revising absent absent');
  assert.deepEqual(f.full.artifacts.spec.pr, { number: 12, url: 'https://github.com/o/r/pull/12' });
  assert.equal(f.full.artifacts.intent.pr, null);
});

test('AC-3: a feature that exists only in an open PR appears with intent proposed', async () => {
  const f = byslug(await run());
  assert.equal(states(f['new-idea']), 'proposed absent absent');
  assert.equal(f['new-idea'].capability, 'alpha', 'capability taken from the PR body');
});

test('features are listed in a stable order and capabilities include PR-only features', async () => {
  const r = await run();
  assert.deepEqual(r.features.map((f) => f.slug), ['full', 'intent-only', 'new-idea', 'no-frontmatter', 'orphan']);
  assert.deepEqual(r.capabilities.map((c) => [c.slug, c.features]), [
    ['alpha', ['full', 'new-idea']],
    ['beta', ['intent-only']],
    ['gamma', []],
  ]);
  assert.deepEqual(r.unassigned, ['no-frontmatter', 'orphan']);
});

test('AC-4 and AC-5: PR linking and artifact versus build', async () => {
  const r = await run();
  const summary = r.prs.map((p) => [p.number, p.state, p.kind, p.features.join(','), p.role]);
  assert.deepEqual(summary, [
    [4, 'merged', 'feature', 'orphan', 'build'],
    [5, 'merged', 'feature', 'full', 'artifact'],
    [6, 'merged', 'feature', 'full', 'build'],
    [10, 'open', 'feature', 'new-idea', 'artifact'],
    [11, 'open', 'feature', 'intent-only', 'artifact'],
    [12, 'open', 'feature', 'full', 'artifact'],
    [13, 'open', 'feature', 'no-frontmatter', 'build'],
    [14, 'open', 'light', '', null],
    [15, 'open', 'unlinked', '', null],
    [16, 'open', 'feature', 'intent-only,orphan', 'artifact'],
  ]);
  const light = r.prs.find((p) => p.number === 14);
  assert.equal(light.light, 'fix a typo');
  assert.equal(light.capability, 'alpha');
  assert.deepEqual(light.size, { files: 1, additions: 1, deletions: 1 });
});

test('changed files win over the body (rule 1 before rule 2)', async () => {
  const pr = { ...PRS.open[0], number: 90, body: 'Feature: full', files: [{ path: 'intent/orphan/spec.md', status: 'added', additions: 1, deletions: 0 }] };
  const r = await run({ ...PRS, open: [pr], merged: [] });
  assert.deepEqual(r.prs[0].features, ['orphan']);
});

test('a body link to a slug that matches no feature is still a feature PR', async () => {
  const pr = { ...PRS.open[0], number: 91, body: 'Feature: ghost', files: [{ path: 'src/x.js', status: 'added', additions: 1, deletions: 0 }] };
  const r = await run({ ...PRS, open: [pr], merged: [] });
  assert.equal(r.prs[0].kind, 'feature');
  assert.deepEqual(r.prs[0].features, ['ghost']);
  assert.ok(!r.features.some((f) => f.slug === 'ghost'), 'no feature is invented from a body line');
});

test('AC-6: lifecycle', async () => {
  const f = byslug(await run());
  assert.equal(f.full.lifecycle, 'shipped');
  assert.equal(f['intent-only'].lifecycle, 'specified');
  assert.equal(f['new-idea'].lifecycle, 'idea');
  assert.equal(f['no-frontmatter'].lifecycle, 'planned');
  assert.equal(f.orphan.lifecycle, 'specified');
});

test('AC-6: shipped needs the build PR merged after the plan was accepted', async () => {
  const early = { ...PRS.merged[2], mergedAt: '2026-09-25T12:00:00Z' }; // build before plan PR #5
  const f = byslug(await run({ ...PRS, merged: [PRS.merged[0], PRS.merged[1], early] }));
  assert.equal(f.full.lifecycle, 'planned', 'a build merged before the plan does not count');
});

test('AC-6 (revised after the live run): a later plan revision does not move acceptance back', async () => {
  // Plan accepted by #5, built and completed by #6, then the plan is updated (#7, e.g. absorbing
  // divergences). The feature stays shipped: acceptance is the FIRST plan merge in the window.
  const revision = { ...PRS.merged[1], number: 7, title: 'Plans: absorb divergences', mergedAt: '2026-10-08T12:00:00Z', url: 'https://github.com/o/r/pull/7' };
  const f = byslug(await run({ ...PRS, merged: [...PRS.merged, revision] }));
  assert.equal(f.full.lifecycle, 'shipped');
});

test('AC-6: plan acceptance PR outside the window: any merged build PR counts', async () => {
  const f = byslug(await run({ ...PRS, merged: [PRS.merged[0], PRS.merged[2]] }));
  assert.equal(f.full.lifecycle, 'shipped');
});

test('AC-6: a merged build PR without "Plan complete: yes" keeps the feature building', async () => {
  const partOne = { ...PRS.merged[2], body: 'Feature: full' };
  const f = byslug(await run({ ...PRS, merged: [PRS.merged[0], PRS.merged[1], partOne] }));
  assert.equal(f.full.lifecycle, 'building');
});

test('AC-6: building when the plan is accepted and a build PR is open', async () => {
  const build = { ...PRS.open[3], number: 92, body: 'Feature: full' };
  const f = byslug(await run({ ...PRS, open: [build], merged: [PRS.merged[1]] }));
  assert.equal(f.full.lifecycle, 'building');
});

test('AC-6: no intent when only a spec exists', async () => {
  const model = { paths: { capabilities: 'capabilities', intent: 'intent' }, capabilities: [], unassigned: ['x'], empty: false,
    features: [{ slug: 'x', capability: null, artifacts: {
      intent: { state: 'absent', path: 'intent/x/intent.md' },
      spec: { state: 'present', path: 'intent/x/spec.md' },
      plan: { state: 'absent', path: 'intent/x/plan.md' } } }] };
  const r = reconcile({ model, prs: { open: [], merged: [], partial: false }, config: CONFIG, now: PRS.now });
  assert.equal(r.features[0].lifecycle, 'no intent');
});

test('AC-7: health with reasons', async () => {
  const f = byslug(await run());
  assert.deepEqual(f.full.health, { status: 'blocked', reason: 'PR #12 inactive for 18 days' });
  assert.deepEqual(f['intent-only'].health, { status: 'blocked', reason: 'PR #11 has changes requested (bob)' });
  assert.deepEqual(f['new-idea'].health, { status: 'on track', reason: 'No open artifact PR is blocked' });
  assert.deepEqual(f['no-frontmatter'].health, { status: 'on track', reason: 'No open artifact PR is blocked' });
});

test('AC-7: a reviewer\'s later approval clears their own request for changes', async () => {
  const pr = { ...PRS.open[1], reviews: PRS.open[1].reviews.filter((r) => r.user === 'alice') };
  const f = byslug(await run({ ...PRS, open: [pr], merged: [] }));
  assert.equal(f['intent-only'].health.status, 'on track');
});

test('AC-7: stale threshold comes from config', async () => {
  const f = byslug(await run(PRS, { health: { stale_days: 30 } }));
  assert.equal(f.full.health.status, 'on track');
});

test('AC-8: waiting queue, one row per artifact, oldest first', async () => {
  const r = await run();
  assert.deepEqual(r.queue.map((q) => [q.feature, q.artifact, q.state, q.pr.number, q.ageDays]), [
    ['full', 'spec', 'revising', 12, 20],
    ['new-idea', 'intent', 'proposed', 10, 8],
    ['intent-only', 'intent', 'revising', 16, 4],
    ['orphan', 'intent', 'revising', 16, 4],
    ['intent-only', 'spec', 'proposed', 11, 3],
  ]);
  assert.deepEqual(r.queue[4].reviewers, ['owner', 'team:product']);
  assert.equal(r.queue[1].pr.url, 'https://github.com/o/r/pull/10');
});

test('AC-9: deterministic, and inputs are not mutated', async () => {
  const before = JSON.stringify(PRS);
  const a = await run();
  const b = await run();
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(PRS), before);
});

test('partial flag is passed through', async () => {
  const r = await run({ ...PRS, partial: true });
  assert.equal(r.partial, true);
});

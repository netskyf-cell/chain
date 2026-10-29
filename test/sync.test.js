'use strict';
// S1b B2: refresh() = connector (through the cache) + reconcile + store. AC-5, AC-6.
const test = require('node:test');
const assert = require('node:assert/strict');
const { refresh, collect, derive } = require('../lib/sync');
const { changedPrefixes } = require('../lib/webhook-events');
const { createHttpCache } = require('../lib/store/http-cache');
const { createMemoryStore } = require('../lib/store/memory');
const { fakeFetch, rawPr, recordedClosed } = require('./fake-github');

const NOW = Date.parse('2026-10-28T15:00:00Z');
const REPO_ROW = { id: 'repo-1', gh_repo_id: 1, gh_owner: 'netskyf-cell', gh_name: 'chain', default_branch: 'main', installation_id: 9, is_public: true };
const files120 = { 120: [{ filename: 'lib/x.js', status: 'added', additions: 3, deletions: 0 }] };

// A fetch that can switch from "before" to "after" GitHub, counting calls on each.
function switchable(before, after) {
  let current = before;
  const f = (...args) => current(...args);
  f.flip = () => { current = after; };
  return f;
}

test('AC-6: the model from refresh() equals the on-demand model for the same facts', async () => {
  const store = createMemoryStore();
  const { model } = await refresh({ repoRow: REPO_ROW, fetch: fakeFetch(), token: 't', store, now: () => NOW });
  const facts = await collect({ owner: 'netskyf-cell', name: 'chain' }, { fetch: fakeFetch(), token: 't', readChecks: true });
  assert.deepEqual(model, derive(facts, new Date(NOW).toISOString()));
  const saved = store._debug.states.get('repo-1');
  assert.deepEqual(saved.features.map((f) => f.slug), model.features.map((f) => f.slug));
  assert.equal(store._debug.snapshots.length, 1);
});

test('AC-5: after a merge webhook, a refresh makes at most 12 GitHub calls and stores the PR as merged', async () => {
  const opened = rawPr(120, { title: 'Build: chain', body: 'Feature: chain', updated_at: '2026-10-28T14:00:00Z' });
  const before = fakeFetch('ok', { open: [opened], files: files120 });
  const merged = { ...opened, state: 'closed', merged_at: '2026-10-28T14:55:00Z', updated_at: '2026-10-28T14:55:00Z' };
  const after = fakeFetch('ok', { open: [], closed: [merged, ...recordedClosed], files: files120 });
  const net = switchable(before, after);
  const store = createMemoryStore();
  const cached = createHttpCache({ store, fetch: net, now: () => NOW });

  await refresh({ repoRow: REPO_ROW, fetch: cached, token: 't', store, now: () => NOW });
  assert.equal(store._debug.states.get('repo-1').pull_requests.find((p) => p.number === 120).state, 'open');

  net.flip();
  await store.markChanged(changedPrefixes('pull_request', { action: 'closed', pull_request: { number: 120 } }, REPO_ROW));
  await refresh({ repoRow: REPO_ROW, fetch: cached, token: 't', store, now: () => NOW + 60 * 1000 });

  assert.ok(after.calls.length <= 12, `made ${after.calls.length} calls`);
  assert.equal(store._debug.states.get('repo-1').pull_requests.find((p) => p.number === 120).state, 'merged');
});

test('the state payload carries S1a and S2 fields for the database', async () => {
  const store = createMemoryStore();
  await refresh({ repoRow: REPO_ROW, fetch: fakeFetch(), token: 't', store, now: () => NOW });
  const p = store._debug.states.get('repo-1');
  const pr13 = p.pull_requests.find((x) => x.number === 13);
  assert.deepEqual(Object.keys(pr13).sort(), ['capability', 'changed_files', 'changed_lines', 'changes_requested', 'checks_state', 'divergences', 'draft', 'feature', 'head_sha', 'kind', 'last_activity_at', 'light_reason', 'merged_at', 'number', 'plan_complete', 'role', 'state', 'title', 'url'].sort());
  assert.equal(pr13.state, 'merged');
  assert.match(pr13.divergences, /One scenario file/);
  assert.ok(p.signals.every((s) => s.rule && s.message && s.evidence_type && s.evidence_at));
  assert.equal(p.artifacts.length, p.features.length * 3);
});

test('webhook marking: push to another branch marks nothing; checks mark their head commit', () => {
  assert.deepEqual(changedPrefixes('push', { ref: 'refs/heads/feature-x' }, REPO_ROW), []);
  assert.deepEqual(changedPrefixes('push', { ref: 'refs/heads/main' }, REPO_ROW), [
    'https://api.github.com/repos/netskyf-cell/chain/commits/HEAD',
    'https://api.github.com/repos/netskyf-cell/chain/commits?',
  ]);
  assert.deepEqual(changedPrefixes('check_run', { check_run: { head_sha: 'abc' } }, REPO_ROW),
    ['https://api.github.com/repos/netskyf-cell/chain/commits/abc/check-runs']);
  assert.deepEqual(changedPrefixes('star', {}, REPO_ROW), []);
});

test('S1b live fix: a webhook refresh 10 min after the last one re-checks only what the event marked, with one cache query per prefix', async () => {
  const { preloadCache, WEBHOOK_MAX_AGE_MS } = require('../lib/store/http-cache');
  const opened = rawPr(120, { title: 'Build: chain', body: 'Feature: chain', updated_at: '2026-10-28T14:00:00Z' });
  const before = fakeFetch('ok', { open: [opened], files: files120 });
  const merged = { ...opened, state: 'closed', merged_at: '2026-10-28T15:09:00Z', updated_at: '2026-10-28T15:09:00Z' };
  const after = fakeFetch('ok', { open: [], closed: [merged, ...recordedClosed], files: files120 });
  const net = switchable(before, after);
  const store = createMemoryStore();
  let now = NOW;
  await refresh({ repoRow: REPO_ROW, fetch: createHttpCache({ store, fetch: net, now: () => now }), token: 't', store, now: () => now });

  // 10 minutes later every entry is older than the 5-minute page-load window.
  now = NOW + 10 * 60 * 1000;
  net.flip();
  await store.markChanged(changedPrefixes('pull_request', { action: 'closed', pull_request: { number: 120 } }, REPO_ROW));
  let singleReads = 0;
  const counting = { ...store, getCache: async (k) => { singleReads += 1; return store.getCache(k); } };
  const preload = await preloadCache(counting, REPO_ROW.gh_owner, REPO_ROW.gh_name);
  const cached = createHttpCache({ store: counting, fetch: net, now: () => now, maxAgeMs: WEBHOOK_MAX_AGE_MS, preload });
  await refresh({ repoRow: REPO_ROW, fetch: cached, token: 't', store, now: () => now });

  assert.ok(after.calls.length <= 12, `made ${after.calls.length} GitHub calls (live run re-checked ~134)`);
  assert.equal(singleReads, 0, 'no per-URL database read');
  assert.equal(store._debug.states.get('repo-1').pull_requests.find((p) => p.number === 120).state, 'merged');
});

test('S1b live fix: overlapping refreshes never replace newer state with older (read start time wins)', async () => {
  const store = createMemoryStore();
  await store.upsertRepo({ gh_repo_id: 1, gh_owner: 'netskyf-cell', gh_name: 'chain', installation_id: 9, is_public: true });
  const row = await store.getRepoByGhId(1);
  // B starts later than A but finishes first; A must not overwrite B.
  let release;
  const gate = new Promise((r) => { release = r; });
  const slowFetch = async (...args) => { await gate; return fakeFetch()(...args); };
  const a = refresh({ repoRow: row, fetch: slowFetch, token: 't', store, now: () => NOW });
  const b = await refresh({ repoRow: row, fetch: fakeFetch(), token: 't', store, now: () => NOW + 1000 });
  release();
  const aResult = await a;
  assert.equal(b.stored, true);
  assert.equal(aResult.stored, false, 'the older read is skipped');
  assert.equal((await store.getRepoByGhId(1)).refreshed_at, new Date(NOW + 1000).toISOString());
});

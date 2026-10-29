'use strict';
// Connector: read-only GitHub reads for one repository (plan step B2).
const test = require('node:test');
const assert = require('node:assert/strict');
const { readRepo, GitHubError } = require('../lib/connectors/github');
const { fakeFetch, SHA } = require('./fake-github');

const REPO = { owner: 'netskyf-cell', name: 'chain' };

test('returns the commit SHA, the file list and a read function', async () => {
  const fetch = fakeFetch();
  const repo = await readRepo(REPO, { fetch });
  assert.equal(repo.sha, SHA);
  assert.equal(repo.truncated, false);
  assert.ok(repo.files.includes('capabilities/flow-visibility.md'));
  assert.ok(repo.files.includes('intent/s0-walking-skeleton/intent.md'));
  assert.ok(!repo.files.includes('capabilities'), 'directories are not listed as files');
  const text = await repo.read('capabilities/flow-visibility.md');
  assert.match(text, /slug: flow-visibility/);
});

test('uses exactly 2 REST calls; file reads go to raw.githubusercontent.com at the commit SHA', async () => {
  const fetch = fakeFetch();
  const repo = await readRepo(REPO, { fetch });
  await repo.read('chain.yml');
  assert.equal(fetch.restCalls(), 2);
  const raw = fetch.calls.find((c) => c.url.includes('raw.githubusercontent.com'));
  assert.ok(raw.url.includes(`/${SHA}/chain.yml`));
});

test('sends the token only in the Authorization header', async () => {
  const fetch = fakeFetch();
  const repo = await readRepo(REPO, { fetch, token: 'tok-123' });
  await repo.read('chain.yml');
  for (const call of fetch.calls) {
    assert.equal(call.headers.Authorization, 'Bearer tok-123');
    assert.ok(!call.url.includes('tok-123'));
  }
});

test('sends no Authorization header without a token', async () => {
  const fetch = fakeFetch();
  await readRepo(REPO, { fetch });
  for (const call of fetch.calls) assert.equal(call.headers.Authorization, undefined);
});

test('maps 404 to not_found', async () => {
  await assert.rejects(readRepo(REPO, { fetch: fakeFetch('not-found') }), (err) => {
    assert.ok(err instanceof GitHubError);
    assert.equal(err.code, 'not_found');
    return true;
  });
});

test('maps an exhausted rate limit to rate_limited', async () => {
  await assert.rejects(readRepo(REPO, { fetch: fakeFetch('rate-limited') }), (err) => err.code === 'rate_limited');
});

test('maps other failures to upstream', async () => {
  await assert.rejects(readRepo(REPO, { fetch: fakeFetch('server-error') }), (err) => err.code === 'upstream');
});

// ---- Pull requests (S1a, plan step B2, AC-10) ----
const { readPullRequests, readHistory, readCompletions, CAPS } = require('../lib/connectors/github');
const { rawPr, recordedClosed } = require('./fake-github');

test('reads merged PRs with their files; closed-but-unmerged PRs are dropped', async () => {
  const fetch = fakeFetch();
  const prs = await readPullRequests(REPO, { fetch });
  assert.equal(prs.open.length, 0);
  assert.equal(prs.merged.length, recordedClosed.filter((p) => p.merged_at).length);
  assert.ok(prs.merged.every((p) => p.mergedAt));
  const intentPr = prs.merged.find((p) => p.files.some((f) => f.path === 'intent/s0-walking-skeleton/intent.md'));
  assert.ok(intentPr, 'the S0 intent PR is found by its files');
  assert.equal(prs.partial, false);
});

test('call budget: 2 lists, then files, reviews and inline comments for every PR (S2)', async () => {
  const open = [rawPr(101), rawPr(102)];
  const fetch = fakeFetch('ok', { open });
  const prs = await readPullRequests(REPO, { fetch });
  const merged = recordedClosed.filter((p) => p.merged_at).length;
  assert.equal(fetch.restCalls(), 2 + 3 * (open.length + merged));
  assert.equal(prs.open.length, 2);
  assert.equal(prs.findingsPartial, false);
});

test('AC-8: reviews of merged PRs stop at 30 and inline comments at 60', async () => {
  const many = Array.from({ length: 30 }, (_, i) => rawPr(200 + i));
  const closed = Array.from({ length: 35 }, (_, i) => rawPr(300 + i, { merged_at: '2026-10-27T12:00:00Z' }));
  const fetch = fakeFetch('ok', { open: many, closed });
  const prs = await readPullRequests(REPO, { fetch });
  const count = (re) => fetch.calls.filter((c) => re.test(new URL(c.url).pathname)).length;
  assert.equal(count(/\/pulls\/3\d\d\/reviews$/), CAPS.mergedReviews);
  assert.equal(count(/\/comments$/), CAPS.comments);
  assert.equal(count(/\/pulls\/2\d\d\/reviews$/), 30, 'open PR reviews (S1a) are not capped by S2');
  assert.equal(prs.findingsPartial, true);
});

test('AC-8: artifact history reads commits per path and the PRs of each commit once', async () => {
  const fetch = fakeFetch();
  const paths = ['intent/chain/spec.md', 'intent/chain/intent.md', 'intent/s0-walking-skeleton/plan.md'];
  const { history, partial } = await readHistory(REPO, { paths, since: '2026-10-26T11:44:35Z' }, { fetch });
  assert.equal(partial, false);
  assert.deepEqual(Object.keys(history), [...paths].sort());
  assert.deepEqual(history['intent/chain/spec.md'].commits.map((c) => c.sha.slice(0, 7)), ['6e12c04', '1c1fade', '5709ba6']);
  assert.deepEqual(history['intent/chain/spec.md'].commits[0].prs, [11]);
  const pullCalls = fetch.calls.filter((c) => /\/commits\/[0-9a-f]+\/pulls$/.test(new URL(c.url).pathname)).length;
  assert.equal(pullCalls, 4, 'shared commits are looked up once');
  assert.ok(fetch.calls.every((c) => !/\/commits\?/.test(c.url) || new URL(c.url).searchParams.get('since') === '2026-10-26T11:44:35Z'));
});

test('AC-8: over the caps, paths are skipped and commits keep unknown PRs', async () => {
  const paths = Array.from({ length: 32 }, (_, i) => `intent/f${String(i).padStart(2, '0')}/intent.md`);
  const historyOver = {};
  paths.forEach((p, i) => {
    historyOver[p] = [{ sha: `a${String(i).padStart(3, '0')}`, html_url: 'https://github.com/x', commit: { committer: { date: '2026-10-27T10:00:00Z' } } }];
  });
  const fetch = fakeFetch('ok', { history: historyOver });
  const { history, partial } = await readHistory(REPO, { paths, since: null }, { fetch });
  assert.equal(partial, true);
  assert.equal(Object.keys(history).length, CAPS.history);
  const commits = Object.values(history).flatMap((h) => h.commits);
  assert.equal(commits.filter((c) => Array.isArray(c.prs)).length, CAPS.commitPulls);
  assert.ok(commits.every((c) => Array.isArray(c.prs) || !('prs' in c)));
});

test('AC-8: history reads send the token only in the Authorization header', async () => {
  const fetch = fakeFetch();
  await readHistory(REPO, { paths: ['intent/chain/spec.md'], since: '2026-10-26T11:44:35Z' }, { fetch, token: 'tok-789' });
  assert.ok(fetch.calls.length > 0);
  for (const call of fetch.calls) {
    assert.equal(call.headers.Authorization, 'Bearer tok-789');
    assert.ok(!call.url.includes('tok-789'));
  }
});

test('maps GitHub fields to PR facts, teams included', async () => {
  const open = [rawPr(103, {
    body: 'Feature: x', labels: [{ name: 'feature:x' }],
    requested_reviewers: [{ login: 'owner' }], requested_teams: [{ slug: 'product' }],
  })];
  const files = { 103: [{ filename: 'intent/x/b.md', previous_filename: 'intent/x/a.md', status: 'renamed', additions: 1, deletions: 0 }] };
  const reviews = { 103: [{ user: { login: 'bob' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-10-27T11:00:00Z' }] };
  const comments = { 103: [{ user: { login: 'rev' }, body: '[compliance] Important: AC-2 not met', created_at: '2026-10-27T12:00:00Z', html_url: 'https://github.com/netskyf-cell/chain/pull/103#discussion_r1' }] };
  const prs = await readPullRequests(REPO, { fetch: fakeFetch('ok', { open, files, reviews, comments }) });
  assert.deepEqual(prs.open[0], {
    number: 103, title: 'PR 103', url: 'https://github.com/netskyf-cell/chain/pull/103', author: 'dev',
    createdAt: '2026-10-27T10:00:00Z', updatedAt: '2026-10-27T10:00:00Z', mergedAt: null, draft: false,
    body: 'Feature: x', labels: ['feature:x'], requestedReviewers: ['owner', 'team:product'],
    files: [{ path: 'intent/x/b.md', status: 'renamed', additions: 1, deletions: 0, previousPath: 'intent/x/a.md' }],
    mergeCommitSha: null,
    headSha: null,
    checks: null,
    reviews: [{ user: 'bob', state: 'CHANGES_REQUESTED', submittedAt: '2026-10-27T11:00:00Z', body: '', url: null }],
    comments: [{ user: 'rev', body: '[compliance] Important: AC-2 not met', createdAt: '2026-10-27T12:00:00Z', url: 'https://github.com/netskyf-cell/chain/pull/103#discussion_r1' }],
  });
});

test('partial is true when GitHub has more open PRs than the 30 read', async () => {
  const prs = await readPullRequests(REPO, { fetch: fakeFetch('ok', { open: [rawPr(104)], next: true }) });
  assert.equal(prs.partial, true);
});

test('pull request reads send the token only in the Authorization header', async () => {
  const fetch = fakeFetch('ok', { open: [rawPr(105)] });
  await readPullRequests(REPO, { fetch, token: 'tok-456' });
  for (const call of fetch.calls) {
    assert.equal(call.headers.Authorization, 'Bearer tok-456');
    assert.ok(!call.url.includes('tok-456'));
  }
});

// S1b plan A3: the connector reads through the HTTP cache unchanged (it takes `fetch`).
test('S1b A3: a second scan through the HTTP cache makes no GitHub call while fresh', async () => {
  const { createHttpCache } = require('../lib/store/http-cache');
  const { createMemoryStore } = require('../lib/store/memory');
  const raw = fakeFetch();
  const store = createMemoryStore();
  const cached = createHttpCache({ store, fetch: raw, now: () => Date.parse('2026-10-29T12:00:00Z') });
  const first = await readPullRequests(REPO, { fetch: cached });
  const callsAfterFirst = raw.calls.length;
  const second = await readPullRequests(REPO, { fetch: cached });
  assert.equal(raw.calls.length, callsAfterFirst, 'all answered from the cache');
  assert.deepEqual(second, first);
});

test('S1b B1: with readChecks, open PRs carry check runs and statuses of their head commit', async () => {
  const open = [rawPr(130, { head: { sha: 'abc123' } }), rawPr(131, { head: { sha: 'def456' } })];
  const checkRuns = { abc123: { check_runs: [{ name: 'test', status: 'completed', conclusion: 'failure' }] } };
  const statuses = { abc123: { statuses: [{ context: 'ci/legacy', state: 'success' }] }, def456: 403 };
  const fetch = fakeFetch('ok', { open, checkRuns, statuses });
  const prs = await readPullRequests(REPO, { fetch, readChecks: true });
  assert.deepEqual(prs.open[0].checks, {
    runs: [{ name: 'test', status: 'completed', conclusion: 'failure' }],
    statuses: [{ context: 'ci/legacy', state: 'success' }],
  });
  assert.equal(prs.open[0].headSha, 'abc123');
  assert.deepEqual(prs.open[1].checks, { runs: [], statuses: [] }, 'runs read (empty); status 403 counts as not read');
  const noChecks = await readPullRequests(REPO, { fetch: fakeFetch('ok', { open }) });
  assert.equal(noChecks.open[0].checks, null, 'demo mode does not read checks');
});

// ---- Older completions (S1 spec, lifecycle revised 2026-10-29) ----------------

const hit = (number, merged_at = '2026-10-01T12:00:00Z') => ({
  number, title: `PR ${number}`, html_url: `https://github.com/netskyf-cell/chain/pull/${number}`,
  user: { login: 'dev' }, created_at: '2026-09-30T12:00:00Z', updated_at: merged_at,
  body: 'Feature: s0-walking-skeleton\nPlan complete: yes', labels: [], pull_request: { merged_at },
});

test('older completions: one search, files for hits outside the window, unmerged and excluded hits dropped', async () => {
  const search = [hit(9), hit(8), { ...hit(7), pull_request: { merged_at: null } }, hit(40)];
  const fetch = fakeFetch('ok', { search, files: { 9: [{ filename: 'lib/x.js', status: 'added', additions: 1, deletions: 0 }] } });
  const { prs, partial } = await readCompletions(REPO, { exclude: [40] }, { fetch });
  assert.deepEqual(prs.map((p) => p.number), [9, 8]);
  assert.equal(prs[0].mergedAt, '2026-10-01T12:00:00Z');
  assert.deepEqual(prs[0].files.map((f) => f.path), ['lib/x.js']);
  assert.equal(partial, false);
  const q = new URL(fetch.calls[0].url).searchParams.get('q');
  assert.equal(q, 'repo:netskyf-cell/chain is:pr is:merged "Plan complete: yes"');
  assert.equal(fetch.calls.length, 3, '1 search + 2 file lists');
});

test('older completions: file reads stop at the cap; a failed search means not read', async () => {
  const search = Array.from({ length: 12 }, (_, i) => hit(100 + i));
  const capped = await readCompletions(REPO, {}, { fetch: fakeFetch('ok', { search }) });
  assert.equal(capped.prs.length, CAPS.completions);
  assert.equal(capped.partial, true);
  const failed = await readCompletions(REPO, {}, { fetch: fakeFetch('ok', { search: 'fail' }) });
  assert.deepEqual(failed, { prs: [], partial: true });
});

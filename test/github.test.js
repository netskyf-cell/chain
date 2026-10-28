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
const { readPullRequests } = require('../lib/connectors/github');
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

test('call budget: 2 lists, files for every PR, reviews for open PRs only', async () => {
  const open = [rawPr(101), rawPr(102)];
  const fetch = fakeFetch('ok', { open });
  const prs = await readPullRequests(REPO, { fetch });
  const merged = recordedClosed.filter((p) => p.merged_at).length;
  assert.equal(fetch.restCalls(), 2 + 2 * open.length + merged);
  assert.ok(!fetch.calls.some((c) => /\/pulls\/\d+\/reviews/.test(c.url) && !/\/pulls\/10[12]\//.test(c.url)));
  assert.equal(prs.open.length, 2);
});

test('maps GitHub fields to PR facts, teams included', async () => {
  const open = [rawPr(103, {
    body: 'Feature: x', labels: [{ name: 'feature:x' }],
    requested_reviewers: [{ login: 'owner' }], requested_teams: [{ slug: 'product' }],
  })];
  const files = { 103: [{ filename: 'intent/x/b.md', previous_filename: 'intent/x/a.md', status: 'renamed', additions: 1, deletions: 0 }] };
  const reviews = { 103: [{ user: { login: 'bob' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-10-27T11:00:00Z' }] };
  const prs = await readPullRequests(REPO, { fetch: fakeFetch('ok', { open, files, reviews }) });
  assert.deepEqual(prs.open[0], {
    number: 103, title: 'PR 103', url: 'https://github.com/netskyf-cell/chain/pull/103', author: 'dev',
    createdAt: '2026-10-27T10:00:00Z', updatedAt: '2026-10-27T10:00:00Z', mergedAt: null, draft: false,
    body: 'Feature: x', labels: ['feature:x'], requestedReviewers: ['owner', 'team:product'],
    files: [{ path: 'intent/x/b.md', status: 'renamed', additions: 1, deletions: 0, previousPath: 'intent/x/a.md' }],
    reviews: [{ user: 'bob', state: 'CHANGES_REQUESTED', submittedAt: '2026-10-27T11:00:00Z' }],
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

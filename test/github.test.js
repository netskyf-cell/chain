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

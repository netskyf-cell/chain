'use strict';
// GET /api/state (S1b): AC-8 serves installed public repos only; freshness rule.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStateHandler } = require('../api/state');
const { createMemoryStore } = require('../lib/store/memory');
const { fakeFetch } = require('./fake-github');

let NOW = Date.parse('2026-10-28T15:00:00Z');

function call(handler, url, ip = '1.2.3.4') {
  return new Promise((resolve) => {
    const req = { method: 'GET', url, headers: {}, socket: { remoteAddress: ip } };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b), raw: b }); } };
    handler(req, res);
  });
}

async function setup() {
  NOW = Date.parse('2026-10-28T15:00:00Z');
  const store = createMemoryStore();
  await store.upsertRepo({ gh_repo_id: 1, gh_owner: 'netskyf-cell', gh_name: 'chain', installation_id: 9, is_public: true, default_branch: 'main' });
  await store.upsertRepo({ gh_repo_id: 2, gh_owner: 'netskyf-cell', gh_name: 'secret-project', installation_id: 9, is_public: false, default_branch: 'main' });
  await store.upsertRepo({ gh_repo_id: 3, gh_owner: 'netskyf-cell', gh_name: 'removed', installation_id: null, is_public: true, default_branch: 'main' });
  const github = fakeFetch();
  const handler = createStateHandler({ store, appAuth: { installationToken: async () => 'ghs_test' }, fetch: github, now: () => NOW });
  return { store, github, handler };
}

test('AC-8: an installed public repository is served with the stored model', async () => {
  const { handler } = await setup();
  const r = await call(handler, '/api/state?repo=netskyf-cell/chain');
  assert.equal(r.status, 200);
  assert.equal(r.body.repo, 'netskyf-cell/chain');
  assert.equal(r.body.installed, true);
  assert.equal(r.body.refreshedAt, '2026-10-28T15:00:00.000Z');
  assert.ok(r.body.model.features.some((f) => f.slug === 's1-state'));
  assert.ok(!r.raw.includes('ghs_test'));
});

test('AC-8: private, uninstalled and unknown repositories get the same 404', async () => {
  const { handler } = await setup();
  const bodies = [];
  for (const repo of ['netskyf-cell/secret-project', 'netskyf-cell/removed', 'someone/unknown']) {
    const r = await call(handler, `/api/state?repo=${repo}`);
    assert.equal(r.status, 404);
    bodies.push(r.raw);
  }
  assert.equal(new Set(bodies).size, 1, 'nothing reveals that a private repository is connected');
});

test('fresh data is served from the database without calling GitHub; stale data is refreshed', async () => {
  const { handler, github } = await setup();
  await call(handler, '/api/state?repo=netskyf-cell/chain');
  const afterFirst = github.calls.length;
  NOW += 2 * 60 * 1000;
  const second = await call(handler, '/api/state?repo=netskyf-cell/chain');
  assert.equal(github.calls.length, afterFirst, 'within 5 minutes: no GitHub call');
  assert.equal(second.body.refreshedAt, '2026-10-28T15:00:00.000Z');
  NOW += 4 * 60 * 1000;
  const third = await call(handler, '/api/state?repo=netskyf-cell/chain');
  assert.equal(third.body.refreshedAt, '2026-10-28T15:06:00.000Z');
});

test('bad input, wrong method and missing configuration', async () => {
  const { handler } = await setup();
  assert.equal((await call(handler, '/api/state?repo=not a repo')).status, 400);
  const unconfigured = createStateHandler({ store: null, now: () => NOW });
  assert.equal((await call(unconfigured, '/api/state?repo=netskyf-cell/chain')).status, 503);
});

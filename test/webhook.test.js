'use strict';
// /api/webhooks/github (S1b): AC-1 signature, AC-2 idempotency, AC-3 unknown repos.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createWebhookHandler } = require('../api/webhooks/github');
const { createMemoryStore } = require('../lib/store/memory');

const SECRET = 'test-webhook-secret';
const NOW = Date.parse('2026-10-29T12:00:00Z');
const payload = (name) => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'webhooks', `${name}.json`));
const sign = (body, secret = SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

// A raw request stream, as Node and Vercel give it.
function request(body, { event, delivery = crypto.randomUUID(), signature = sign(body), method = 'POST' } = {}) {
  const req = Readable.from([body]);
  req.method = method;
  req.headers = { 'x-github-event': event, 'x-github-delivery': delivery, ...(signature ? { 'x-hub-signature-256': signature } : {}) };
  return req;
}

function call(handler, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b) }); } };
    handler(req, res);
  });
}

function setup() {
  const store = createMemoryStore();
  const refreshes = [];
  const handler = createWebhookHandler({
    secret: SECRET,
    store,
    appAuth: { installationToken: async () => 'ghs_test' },
    fetch: async () => { throw new Error('no network in tests'); },
    now: () => NOW,
    refresh: async (args) => { refreshes.push(args); },
  });
  return { store, handler, refreshes };
}

async function installChain(store) {
  return store.upsertRepo({ gh_repo_id: 1, gh_owner: 'netskyf-cell', gh_name: 'chain', installation_id: 9, is_public: true, default_branch: 'main' });
}

test('AC-1: a wrong, missing or other-secret signature gets 401 and changes nothing', async () => {
  const { store, handler, refreshes } = setup();
  await installChain(store);
  const body = payload('pull_request.closed');
  for (const signature of [null, 'sha256=00', sign(body, 'other-secret'), sign(Buffer.from('{}'))]) {
    const r = await call(handler, request(body, { event: 'pull_request', signature }));
    assert.equal(r.status, 401);
  }
  assert.equal(refreshes.length, 0);
  assert.equal(store._debug.deliveries.size, 0);
});

test('AC-1: a valid pull_request event gets 202, marks that PR and refreshes with the installation token', async () => {
  const { store, handler, refreshes } = setup();
  await installChain(store);
  await store.putCache({ key: 'https://api.github.com/repos/netskyf-cell/chain/pulls/120/files?per_page=100', changed: false, checkedAt: new Date(NOW).toISOString() });
  await store.putCache({ key: 'https://api.github.com/repos/netskyf-cell/chain/pulls/12/files?per_page=100', changed: false, checkedAt: new Date(NOW).toISOString() });
  const r = await call(handler, request(payload('pull_request.closed'), { event: 'pull_request' }));
  assert.deepEqual(r, { status: 202, body: { status: 'refreshed' } });
  assert.equal(refreshes.length, 1);
  assert.equal(refreshes[0].token, 'ghs_test');
  assert.equal(refreshes[0].repoRow.gh_name, 'chain');
  assert.equal((await store.getCache('https://api.github.com/repos/netskyf-cell/chain/pulls/120/files?per_page=100')).changed, true);
  assert.equal((await store.getCache('https://api.github.com/repos/netskyf-cell/chain/pulls/12/files?per_page=100')).changed, false);
});

test('AC-2: the same delivery twice is processed once', async () => {
  const { store, handler, refreshes } = setup();
  await installChain(store);
  const body = payload('check_run.completed');
  const first = await call(handler, request(body, { event: 'check_run', delivery: 'd-1' }));
  const second = await call(handler, request(body, { event: 'check_run', delivery: 'd-1' }));
  assert.equal(first.body.status, 'refreshed');
  assert.deepEqual(second, { status: 202, body: { status: 'duplicate' } });
  assert.equal(refreshes.length, 1);
});

test('AC-3: events for repositories that are not connected are dropped', async () => {
  const { handler, refreshes } = setup();
  const r = await call(handler, request(payload('push.main'), { event: 'push' }));
  assert.deepEqual(r, { status: 202, body: { status: 'ignored' } });
  assert.equal(refreshes.length, 0);
});

test('a push to another branch is ignored; a push to main refreshes', async () => {
  const { store, handler, refreshes } = setup();
  await installChain(store);
  assert.equal((await call(handler, request(payload('push.branch'), { event: 'push' }))).body.status, 'ignored');
  assert.equal((await call(handler, request(payload('push.main'), { event: 'push' }))).body.status, 'refreshed');
  assert.equal(refreshes.length, 1);
});

test('installation events record repositories, with visibility, and removals', async () => {
  const { store, handler } = setup();
  const created = await call(handler, request(payload('installation.created'), { event: 'installation' }));
  assert.deepEqual(created.body, { status: 'installation', added: 2, removed: 0 });
  assert.equal((await store.getRepoByGhId(1)).is_public, true);
  assert.equal((await store.getRepoByGhId(2)).is_public, false);
  await call(handler, request(payload('installation_repositories.removed'), { event: 'installation_repositories' }));
  assert.equal((await store.getRepoByGhId(2)).installation_id, null);
  assert.equal((await store.getRepoByGhId(1)).installation_id, 9);
});

test('a Vercel-style pre-read Buffer body is verified the same way; GET is refused', async () => {
  const { store, handler } = setup();
  await installChain(store);
  const body = payload('push.main');
  const req = { method: 'POST', body, headers: { 'x-github-event': 'push', 'x-github-delivery': 'd-buf', 'x-hub-signature-256': sign(body) } };
  assert.equal((await call(handler, req)).status, 202);
  assert.equal((await call(handler, { method: 'GET', headers: {} })).status, 405);
});

test('without configuration the endpoint answers 503, never 500', async () => {
  const handler = createWebhookHandler({ secret: null, store: null });
  const body = payload('push.main');
  assert.equal((await call(handler, request(body, { event: 'push' }))).status, 503);
});

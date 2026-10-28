'use strict';
// Endpoint GET /api/demo?repo=owner/name (plan step B3): AC-6, AC-7, AC-8.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDemoHandler } = require('../api/demo');
const { fakeFetch, SHA } = require('./fake-github');

// Minimal request and response objects, compatible with node:http and Vercel.
function call(handler, url, { method = 'GET', ip = '1.2.3.4' } = {}) {
  return new Promise((resolve) => {
    const req = { method, url, headers: {}, socket: { remoteAddress: ip } };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(body) { resolve({ status: this.statusCode, headers: this.headers, body: body ? JSON.parse(body) : null, raw: body }); },
    };
    handler(req, res);
  });
}

function setup(mode = 'ok', { token = 'secret-token-xyz', start = 0 } = {}) {
  const fetch = fakeFetch(mode);
  let now = start;
  const handler = createDemoHandler({ fetch, token, now: () => now });
  return { handler, fetch, advance: (ms) => { now += ms; } };
}

test('AC-6: returns the model for a repository', async () => {
  const { handler } = setup();
  const r = await call(handler, '/api/demo?repo=netskyf-cell/chain');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(r.body.repo, 'netskyf-cell/chain');
  assert.equal(r.body.sha, SHA);
  assert.equal(r.body.truncated, false);
  const flow = r.body.model.capabilities.find((c) => c.slug === 'flow-visibility');
  assert.deepEqual(flow.features, ['s0-walking-skeleton', 's1-state']);
  assert.equal(r.body.model.capabilities.length, 5);
});

test('AC-11: the model carries S1a state from pull requests', async () => {
  const { handler } = setup('ok', { start: Date.parse('2026-10-28T15:00:00Z') });
  const r = await call(handler, '/api/demo?repo=netskyf-cell/chain');
  assert.equal(r.status, 200);
  assert.equal(r.body.partial, false);
  const s0 = r.body.model.features.find((f) => f.slug === 's0-walking-skeleton');
  assert.deepEqual(['intent', 'spec', 'plan'].map((k) => s0.artifacts[k].state), ['accepted', 'accepted', 'accepted']);
  assert.equal(s0.lifecycle, 'shipped', 'S0 build PRs were merged after its plan');
  assert.deepEqual(s0.health, { status: 'on track', reason: 'No open artifact PR is blocked' });
  assert.deepEqual(r.body.model.queue, []);
  const pr8 = r.body.model.prs.find((p) => p.number === 8);
  // PR #8 says "Light change:" but also edits intent files: rule 1 (files) wins over rule 4.
  assert.equal(pr8.kind, 'feature');
  assert.deepEqual(pr8.features, ['chain']);
});

test('accepts a full GitHub URL as well as owner/name', async () => {
  const { handler } = setup();
  const r = await call(handler, '/api/demo?repo=' + encodeURIComponent('https://github.com/netskyf-cell/chain'));
  assert.equal(r.status, 200);
  assert.equal(r.body.repo, 'netskyf-cell/chain');
});

test('AC-7: invalid repo format returns 400', async () => {
  const { handler, fetch } = setup();
  for (const bad of ['', 'nope', 'a/b/c', '../etc', '-bad/name', 'owner/..']) {
    const r = await call(handler, '/api/demo?repo=' + encodeURIComponent(bad));
    assert.equal(r.status, 400, `expected 400 for "${bad}"`);
  }
  assert.equal(fetch.calls.length, 0, 'no GitHub call for invalid input');
});

test('AC-7: unknown or private repository returns 404 with a readable message', async () => {
  const { handler } = setup('not-found');
  const r = await call(handler, '/api/demo?repo=someone/missing');
  assert.equal(r.status, 404);
  assert.match(r.body.error, /not found or not public/i);
});

test('AC-7: GitHub rate limit returns 503 with "try again later"', async () => {
  const { handler } = setup('rate-limited');
  const r = await call(handler, '/api/demo?repo=netskyf-cell/chain');
  assert.equal(r.status, 503);
  assert.match(r.body.error, /try again later/i);
});

test('AC-7: no response ever contains the token', async () => {
  for (const mode of ['ok', 'not-found', 'rate-limited', 'server-error']) {
    const { handler } = setup(mode);
    const r = await call(handler, '/api/demo?repo=netskyf-cell/chain');
    assert.ok(!r.raw.includes('secret-token-xyz'), `token leaked in ${mode}`);
  }
});

test('AC-8: a second request within 5 minutes makes no GitHub call', async () => {
  const { handler, fetch, advance } = setup();
  await call(handler, '/api/demo?repo=netskyf-cell/chain');
  const after = fetch.calls.length;
  advance(4 * 60 * 1000);
  const r = await call(handler, '/api/demo?repo=NETSKYF-CELL/Chain');
  assert.equal(r.status, 200);
  assert.equal(fetch.calls.length, after);
});

test('after 5 minutes the cache expires and GitHub is read again', async () => {
  const { handler, fetch, advance } = setup();
  await call(handler, '/api/demo?repo=netskyf-cell/chain');
  const after = fetch.calls.length;
  advance(5 * 60 * 1000 + 1);
  await call(handler, '/api/demo?repo=netskyf-cell/chain');
  assert.ok(fetch.calls.length > after);
});

test('errors are not cached', async () => {
  const fetch = fakeFetch('server-error');
  const handler = createDemoHandler({ fetch, token: '', now: () => 0 });
  await call(handler, '/api/demo?repo=netskyf-cell/chain');
  const after = fetch.calls.length;
  await call(handler, '/api/demo?repo=netskyf-cell/chain');
  assert.ok(fetch.calls.length > after);
});

test('only GET is allowed', async () => {
  const { handler } = setup();
  const r = await call(handler, '/api/demo?repo=netskyf-cell/chain', { method: 'POST' });
  assert.equal(r.status, 405);
});

test('rate limit per client: the 31st request in a minute returns 429', async () => {
  const { handler } = setup();
  let last;
  for (let i = 0; i < 31; i++) last = await call(handler, '/api/demo?repo=netskyf-cell/chain', { ip: '9.9.9.9' });
  assert.equal(last.status, 429);
  const other = await call(handler, '/api/demo?repo=netskyf-cell/chain', { ip: '8.8.8.8' });
  assert.equal(other.status, 200);
});

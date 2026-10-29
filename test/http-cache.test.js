'use strict';
// AC-4 (S1b): fresh entries need no request; stale or webhook-marked entries are
// re-checked with If-None-Match; a 304 reuses the stored body.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHttpCache } = require('../lib/store/http-cache');
const { createMemoryStore } = require('../lib/store/memory');

const URL_A = 'https://api.github.com/repos/o/r/pulls/9/files?per_page=100';

// A fake GitHub that serves one resource with an ETag and answers 304 on a match.
function fakeGitHub() {
  let version = 1;
  const calls = [];
  async function fetch(url, opts = {}) {
    calls.push({ url, headers: opts.headers || {} });
    const etag = `"v${version}"`;
    const respHeaders = { etag, link: '<https://x?page=2>; rel="next"' };
    if ((opts.headers || {})['If-None-Match'] === etag) {
      return { ok: false, status: 304, headers: { get: () => null }, text: async () => '' };
    }
    const body = JSON.stringify([{ filename: `v${version}.js` }]);
    return { ok: true, status: 200, headers: { get: (n) => respHeaders[n.toLowerCase()] ?? null }, text: async () => body, json: async () => JSON.parse(body) };
  }
  return { fetch, calls, bump: () => { version += 1; } };
}

function setup() {
  let now = Date.parse('2026-10-29T12:00:00Z');
  const gh = fakeGitHub();
  const store = createMemoryStore();
  const cached = createHttpCache({ store, fetch: gh.fetch, now: () => now });
  return { gh, store, cached, advance: (ms) => { now += ms; } };
}

test('no entry: one request, the body and Link header are stored', async () => {
  const { gh, store, cached } = setup();
  const res = await cached(URL_A, { headers: { Authorization: 'Bearer ghs_secret' } });
  assert.deepEqual(await res.json(), [{ filename: 'v1.js' }]);
  assert.match(res.headers.get('link'), /rel="next"/);
  assert.equal(gh.calls.length, 1);
  const entry = await store.getCache(URL_A);
  assert.equal(entry.etag, '"v1"');
  assert.ok(!JSON.stringify(entry).includes('ghs_secret'), 'the token is never stored');
});

test('AC-4: a fresh entry is answered without a request', async () => {
  const { gh, cached, advance } = setup();
  await cached(URL_A);
  advance(4 * 60 * 1000);
  const res = await cached(URL_A);
  assert.deepEqual(await res.json(), [{ filename: 'v1.js' }]);
  assert.equal(gh.calls.length, 1);
  assert.equal(cached.stats.fresh, 1);
});

test('AC-4: a stale entry is re-checked with If-None-Match; a 304 reuses the body', async () => {
  const { gh, cached, advance } = setup();
  await cached(URL_A);
  advance(6 * 60 * 1000);
  const res = await cached(URL_A);
  assert.equal(gh.calls[1].headers['If-None-Match'], '"v1"');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [{ filename: 'v1.js' }]);
  assert.equal(cached.stats.notModified, 1);
  // The 304 refreshed checkedAt: the next call is fresh again.
  await cached(URL_A);
  assert.equal(gh.calls.length, 2);
});

test('AC-4: a webhook-marked entry is re-checked at once, and a change is picked up', async () => {
  const { gh, store, cached } = setup();
  await cached(URL_A);
  gh.bump();
  await store.markChanged(['https://api.github.com/repos/o/r/pulls/9/']);
  const res = await cached(URL_A);
  assert.deepEqual(await res.json(), [{ filename: 'v2.js' }]);
  assert.equal(gh.calls.length, 2);
  assert.equal((await store.getCache(URL_A)).changed, false);
});

test('errors and non-GET requests pass through and are not cached', async () => {
  const { store } = setup();
  const failing = createHttpCache({
    store,
    fetch: async () => ({ ok: false, status: 404, headers: { get: () => null }, text: async () => '' }),
    now: () => 0,
  });
  assert.equal((await failing(URL_A)).status, 404);
  assert.equal(await store.getCache(URL_A), null);
  let posted = 0;
  const post = createHttpCache({ store, fetch: async () => { posted += 1; return { ok: true, status: 201 }; }, now: () => 0 });
  await post('https://api.github.com/app/installations/1/access_tokens', { method: 'POST' });
  assert.equal(posted, 1);
  assert.equal(await store.getCache('https://api.github.com/app/installations/1/access_tokens'), null);
});

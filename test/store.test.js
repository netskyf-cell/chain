'use strict';
// Supabase store (S1b plan A4): PostgREST request shapes; the key only in headers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseStore } = require('../lib/store/supabase');

const KEY = 'sb_secret_TESTKEY';

function fakeFetch(replies = []) {
  const calls = [];
  async function fetch(url, opts = {}) {
    calls.push({ url, method: opts.method, headers: opts.headers, body: opts.body && JSON.parse(opts.body) });
    const r = replies.shift() || { status: 200, body: [] };
    return { ok: r.status < 300, status: r.status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  }
  fetch.calls = calls;
  return fetch;
}

const store = (fetch, key = KEY) => createSupabaseStore({ url: 'https://abc.supabase.co/', key, fetch });

test('the secret key goes in the apikey header only, never in a URL or body', async () => {
  const fetch = fakeFetch([{ status: 200, body: [] }]);
  await store(fetch).getCache('https://api.github.com/x');
  const c = fetch.calls[0];
  assert.equal(c.headers.apikey, KEY);
  assert.equal(c.headers.Authorization, undefined, 'sb_secret keys are not JWTs');
  assert.ok(!c.url.includes(KEY));
  assert.equal(c.url, 'https://abc.supabase.co/rest/v1/sync_cache?key=eq.https%3A%2F%2Fapi.github.com%2Fx&select=*');
});

test('a legacy JWT key is also sent as a Bearer token', async () => {
  const fetch = fakeFetch();
  await store(fetch, 'eyJhbGciOi.legacy.key').getRepoByGhId(1);
  assert.equal(fetch.calls[0].headers.Authorization, 'Bearer eyJhbGciOi.legacy.key');
});

test('cache upsert and webhook marking use PostgREST upsert and like', async () => {
  const fetch = fakeFetch([{ status: 201 }, { status: 204 }]);
  const s = store(fetch);
  await s.putCache({ key: 'k', etag: '"e"', body: '[]', headers: { link: 'l' }, fetchedAt: 't', checkedAt: 't', changed: false });
  await s.markChanged(['https://api.github.com/repos/o/r/pulls/9/']);
  assert.equal(fetch.calls[0].url, 'https://abc.supabase.co/rest/v1/sync_cache?on_conflict=key');
  assert.match(fetch.calls[0].headers.Prefer, /resolution=merge-duplicates/);
  assert.deepEqual(fetch.calls[0].body.body, { text: '[]', headers: { link: 'l' } });
  assert.equal(fetch.calls[1].method, 'PATCH');
  assert.match(fetch.calls[1].url, /sync_cache\?key=like\.https%3A%2F%2Fapi\.github\.com%2Frepos%2Fo%2Fr%2Fpulls%2F9%2F\*$/);
  assert.deepEqual(fetch.calls[1].body, { changed: true });
});

test('replaceState calls the replace_repo_state RPC with the repo id and payload', async () => {
  const fetch = fakeFetch([{ status: 204 }]);
  await store(fetch).replaceState('uuid-1', { features: [] });
  assert.equal(fetch.calls[0].url, 'https://abc.supabase.co/rest/v1/rpc/replace_repo_state');
  assert.deepEqual(fetch.calls[0].body, { p_repo: 'uuid-1', p: { features: [] } });
});

test('recordDelivery is true the first time and false for a redelivery', async () => {
  const fetch = fakeFetch([{ status: 201, body: [{ delivery_id: 'd1' }] }, { status: 201, body: [] }]);
  const s = store(fetch);
  assert.equal(await s.recordDelivery('d1', 'push', 't'), true);
  assert.equal(await s.recordDelivery('d1', 'push', 't'), false);
  assert.match(fetch.calls[0].headers.Prefer, /resolution=ignore-duplicates/);
});

test('saveSnapshot keeps the newest 20: deletes from the 21st newest down', async () => {
  const fetch = fakeFetch([{ status: 201 }, { status: 200, body: [{ observed_at: '2026-10-01T00:00:00Z' }] }, { status: 204 }]);
  await store(fetch).saveSnapshot('uuid-1', { facts: 1 }, '2026-10-29T12:00:00Z');
  assert.match(fetch.calls[1].url, /order=observed_at\.desc&offset=20&limit=1$/);
  assert.equal(fetch.calls[2].method, 'DELETE');
  assert.match(fetch.calls[2].url, /observed_at=lte\.2026-10-01T00%3A00%3A00Z$/);
});

test('errors name the table and status, never the key', async () => {
  const fetch = fakeFetch([{ status: 401, body: { message: `bad key ${KEY}` } }]);
  await assert.rejects(store(fetch).getRepoByName('o', 'r'), (err) => {
    assert.equal(err.message, 'Supabase GET repos failed (401)');
    return true;
  });
  assert.throws(() => createSupabaseStore({ url: '', key: KEY, fetch }), /not configured/);
});

test('getCacheMany reads a whole prefix in one request', async () => {
  const fetch = fakeFetch([{ status: 200, body: [{ key: 'k1', etag: null, body: { text: '[]', headers: {} }, checked_at: 't', changed: false }] }]);
  const rows = await store(fetch).getCacheMany('https://api.github.com/repos/o/r/');
  assert.equal(fetch.calls.length, 1);
  assert.match(fetch.calls[0].url, /sync_cache\?key=like\.https%3A%2F%2Fapi\.github\.com%2Frepos%2Fo%2Fr%2F\*&select=\*$/);
  assert.deepEqual(rows.map((r) => r.key), ['k1']);
});

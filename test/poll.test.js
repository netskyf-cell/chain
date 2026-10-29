'use strict';
// S1b AC-11 and the front end's data source: polling only while visible; /api/state
// first, /api/demo as fallback.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => Promise.all([import('../public/js/poll.js'), import('../public/js/api.js')]);

function fakeDoc(state = 'visible') {
  const listeners = new Set();
  return {
    visibilityState: state,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    set(s) { this.visibilityState = s; for (const fn of listeners) fn(); },
    listeners,
  };
}

function fakeTimers() {
  const active = new Map();
  let id = 0;
  return {
    setInterval: (fn) => { id += 1; active.set(id, fn); return id; },
    clearInterval: (t) => active.delete(t),
    fire: async () => { for (const fn of [...active.values()]) await fn(); },
    active,
  };
}

const flush = () => new Promise((r) => setImmediate(r));

test('AC-11: polls while visible, stops while hidden, reloads at once when visible again', async () => {
  const [{ startPolling }] = await load();
  const doc = fakeDoc();
  const timers = fakeTimers();
  let loads = 0;
  const seen = [];
  const stop = startPolling({ load: async () => { loads += 1; return loads; }, onData: (d) => seen.push(d), doc, timers });
  assert.equal(timers.active.size, 1);
  await timers.fire();
  assert.deepEqual(seen, [1]);
  doc.set('hidden');
  assert.equal(timers.active.size, 0, 'no timer while hidden');
  doc.set('visible');
  await flush();
  assert.deepEqual(seen, [1, 2], 'immediate reload on return');
  assert.equal(timers.active.size, 1);
  stop();
  assert.equal(timers.active.size, 0);
  assert.equal(doc.listeners.size, 0);
});

test('a failed reload keeps polling and reports the error', async () => {
  const [{ startPolling }] = await load();
  const timers = fakeTimers();
  const errors = [];
  startPolling({ load: async () => { throw new Error('offline'); }, onData: () => {}, onError: (e) => errors.push(e.message), doc: fakeDoc(), timers });
  await timers.fire();
  assert.deepEqual(errors, ['offline']);
  assert.equal(timers.active.size, 1);
});

test('clock() formats a time as hh:mm and tolerates bad input', async () => {
  const [{ clock }] = await load();
  assert.match(clock('2026-10-29T12:05:00Z'), /^\d\d:05$/);
  assert.equal(clock('nope'), '');
});

function fakeFetch(map) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const key = url.split('?')[0];
    const [status, body] = map[key];
    return { ok: status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

test('loadRepo: an installed repository comes from /api/state', async () => {
  const [, { loadRepo }] = await load();
  const f = fakeFetch({ '/api/state': [200, { repo: 'o/r', installed: true }] });
  assert.deepEqual(await loadRepo('o/r', f), { repo: 'o/r', installed: true, source: 'state' });
  assert.deepEqual(f.calls, ['/api/state?repo=o%2Fr']);
});

test('loadRepo: not connected (404) or not configured (503) falls back to /api/demo', async () => {
  const [, { loadRepo }] = await load();
  for (const status of [404, 503]) {
    const f = fakeFetch({ '/api/state': [status, { error: 'x' }], '/api/demo': [200, { repo: 'o/r' }] });
    assert.equal((await loadRepo('o/r', f)).source, 'demo');
  }
});

test('loadRepo: other errors are shown, not hidden by the fallback', async () => {
  const [, { loadRepo }] = await load();
  const f = fakeFetch({ '/api/state': [429, { error: 'Too many requests.' }] });
  await assert.rejects(loadRepo('o/r', f), /Too many requests/);
  const g = fakeFetch({ '/api/state': [404, {}], '/api/demo': [404, { error: 'Repository not found or not public.' }] });
  await assert.rejects(loadRepo('o/r', g), /not found or not public/);
});

'use strict';
// HTTP cache under the GitHub connector (ADR-0014, spec S1b "Refresh without
// re-reading everything"). It has the same shape as fetch, so the connector does not
// change: pass `cachedFetch` where it takes `fetch`.
//
// - fresh entry (checked < maxAge ago and not marked by a webhook): no request
// - stale or marked entry: request with If-None-Match; a 304 reuses the stored body
//   (GitHub does not count a 304 against the rate limit)
// - no entry: normal request; a 200 with an ETag is stored
// Only GET requests are cached. The key is the URL: never the token, which stays in
// the Authorization header and is never stored.

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const KEPT_HEADERS = ['link', 'etag'];

function cachedResponse(entry) {
  const headers = entry.headers || {};
  return {
    ok: true,
    status: 200,
    fromCache: true,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => JSON.parse(entry.body),
    text: async () => entry.body,
  };
}

function createHttpCache({ store, fetch, now, maxAgeMs = DEFAULT_MAX_AGE_MS }) {
  const stats = { network: 0, notModified: 0, fresh: 0 };

  async function cachedFetch(url, opts = {}) {
    if (opts.method && opts.method !== 'GET') return fetch(url, opts);
    const entry = await store.getCache(url);
    const nowMs = now();

    if (entry && !entry.changed && nowMs - Date.parse(entry.checkedAt) < maxAgeMs) {
      stats.fresh += 1;
      return cachedResponse(entry);
    }

    const headers = { ...(opts.headers || {}) };
    if (entry && entry.etag) headers['If-None-Match'] = entry.etag;
    stats.network += 1;
    const res = await fetch(url, { ...opts, headers });

    if (res.status === 304 && entry) {
      stats.notModified += 1;
      await store.putCache({ ...entry, checkedAt: new Date(nowMs).toISOString(), changed: false });
      return cachedResponse(entry);
    }
    if (!res.ok) return res;

    const body = await res.text();
    const kept = {};
    for (const name of KEPT_HEADERS) {
      const v = res.headers && res.headers.get(name);
      if (v) kept[name] = v;
    }
    const stamp = new Date(nowMs).toISOString();
    await store.putCache({ key: url, etag: kept.etag || null, body, headers: kept, fetchedAt: stamp, checkedAt: stamp, changed: false });
    return cachedResponse({ body, headers: kept });
  }

  cachedFetch.stats = stats;
  return cachedFetch;
}

module.exports = { createHttpCache, DEFAULT_MAX_AGE_MS };

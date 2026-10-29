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
// After a webhook, GitHub has told us what changed: everything else is trusted for a day.
const WEBHOOK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// URL prefixes of everything cached for one repository (API and raw files).
function repoPrefixes(owner, name) {
  const o = encodeURIComponent(owner);
  const n = encodeURIComponent(name);
  return [`https://api.github.com/repos/${o}/${n}/`, `https://raw.githubusercontent.com/${o}/${n}/`];
}

// Reads all of a repository's cache entries in one query per prefix (instead of one per URL).
async function preloadCache(store, owner, name) {
  const map = new Map();
  for (const prefix of repoPrefixes(owner, name)) {
    for (const entry of await store.getCacheMany(prefix)) map.set(entry.key, entry);
  }
  return map;
}
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

function createHttpCache({ store, fetch, now, maxAgeMs = DEFAULT_MAX_AGE_MS, preload = null }) {
  const stats = { network: 0, notModified: 0, fresh: 0 };

  async function cachedFetch(url, opts = {}) {
    if (opts.method && opts.method !== 'GET') return fetch(url, opts);
    // With a preload (one query for the whole repository), no per-URL database read.
    const entry = preload ? preload.get(url) || null : await store.getCache(url);
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
      const updated = { ...entry, checkedAt: new Date(nowMs).toISOString(), changed: false };
      await store.putCache(updated);
      if (preload) preload.set(url, updated);
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
    const stored = { key: url, etag: kept.etag || null, body, headers: kept, fetchedAt: stamp, checkedAt: stamp, changed: false };
    await store.putCache(stored);
    if (preload) preload.set(url, stored);
    return cachedResponse({ body, headers: kept });
  }

  cachedFetch.stats = stats;
  return cachedFetch;
}

module.exports = { createHttpCache, preloadCache, repoPrefixes, DEFAULT_MAX_AGE_MS, WEBHOOK_MAX_AGE_MS };

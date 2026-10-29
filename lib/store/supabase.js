'use strict';
// Supabase store through PostgREST (`fetch`, no client library: ADR-0009, spec S1b).
// Server side only (api/): the key bypasses row-level security. It travels in the
// `apikey` header (and as a Bearer token only when it is a legacy JWT key), never in a
// URL, an error message or a log line.

class StoreError extends Error {
  constructor(message, status) {
    super(message);
    this.code = 'store';
    this.status = status;
  }
}

function createSupabaseStore({ url, key, fetch }) {
  if (!url || !key) throw new StoreError('Supabase is not configured');
  const base = `${String(url).replace(/\/+$/, '')}/rest/v1`;
  const headers = (extra = {}) => ({
    apikey: key,
    ...(String(key).startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  });
  const q = encodeURIComponent;

  async function call(method, path, { body, prefer } = {}) {
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: headers(prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new StoreError(`Supabase ${method} ${path.split('?')[0]} failed (${res.status})`, res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  const toEntry = (row) => row && {
    key: row.key,
    etag: row.etag,
    body: row.body && row.body.text,
    headers: (row.body && row.body.headers) || {},
    fetchedAt: row.fetched_at,
    checkedAt: row.checked_at,
    changed: row.changed,
  };

  return {
    async getCache(key) {
      const rows = await call('GET', `sync_cache?key=eq.${q(key)}&select=*`);
      return toEntry(rows[0]) || null;
    },
    async getCacheMany(prefix) {
      const rows = await call('GET', `sync_cache?key=like.${q(`${prefix}*`)}&select=*`);
      return rows.map(toEntry);
    },
    async putCache(e) {
      await call('POST', 'sync_cache?on_conflict=key', {
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: {
          key: e.key, etag: e.etag, body: { text: e.body, headers: e.headers || {} },
          fetched_at: e.fetchedAt, checked_at: e.checkedAt, changed: Boolean(e.changed),
        },
      });
    },
    async markChanged(prefixes) {
      for (const p of prefixes) {
        await call('PATCH', `sync_cache?key=like.${q(`${p}*`)}`, { prefer: 'return=minimal', body: { changed: true } });
      }
    },
    async getRepoByGhId(ghRepoId) {
      const rows = await call('GET', `repos?gh_repo_id=eq.${q(ghRepoId)}&select=*`);
      return rows[0] || null;
    },
    async getRepoByName(owner, name) {
      const rows = await call('GET', `repos?gh_owner=ilike.${q(owner)}&gh_name=ilike.${q(name)}&select=*`);
      return rows[0] || null;
    },
    async upsertRepo(row) {
      const rows = await call('POST', 'repos?on_conflict=gh_repo_id', {
        prefer: 'resolution=merge-duplicates,return=representation',
        body: row,
      });
      return rows[0];
    },
    async removeInstallation(ghRepoIds) {
      if (!ghRepoIds.length) return;
      await call('PATCH', `repos?gh_repo_id=in.(${ghRepoIds.map(Number).join(',')})`, {
        prefer: 'return=minimal',
        body: { installation_id: null },
      });
    },
    async saveSnapshot(repoId, payload, observedAt, keep = 20) {
      await call('POST', 'observations', {
        prefer: 'return=minimal',
        body: { repo_id: repoId, source: 'github', kind: 'snapshot', payload, observed_at: observedAt },
      });
      const older = await call('GET', `observations?repo_id=eq.${q(repoId)}&kind=eq.snapshot&select=observed_at&order=observed_at.desc&offset=${keep}&limit=1`);
      if (older.length) {
        await call('DELETE', `observations?repo_id=eq.${q(repoId)}&kind=eq.snapshot&observed_at=lte.${q(older[0].observed_at)}`, { prefer: 'return=minimal' });
      }
    },
    async latestSnapshot(repoId) {
      const rows = await call('GET', `observations?repo_id=eq.${q(repoId)}&kind=eq.snapshot&select=payload,observed_at&order=observed_at.desc&limit=1`);
      return rows[0] ? { repoId, payload: rows[0].payload, observedAt: rows[0].observed_at } : null;
    },
    async replaceState(repoId, payload) {
      await call('POST', 'rpc/replace_repo_state', { body: { p_repo: repoId, p: payload } });
    },
    async recordDelivery(deliveryId, event, receivedAt) {
      const rows = await call('POST', 'webhook_deliveries?on_conflict=delivery_id', {
        prefer: 'resolution=ignore-duplicates,return=representation',
        body: { delivery_id: deliveryId, event, received_at: receivedAt },
      });
      return Array.isArray(rows) && rows.length > 0;
    },
  };
}

module.exports = { createSupabaseStore, StoreError };

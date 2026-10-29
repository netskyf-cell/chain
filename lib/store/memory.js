'use strict';
// In-memory store with the same interface as lib/store/supabase.js.
// Used by tests and by local development without Supabase.

function createMemoryStore() {
  const cache = new Map();
  const repos = new Map(); // id -> row
  const snapshots = []; // { repoId, payload, observedAt }
  const states = new Map(); // repoId -> payload
  const deliveries = new Map();
  let nextId = 1;

  return {
    // sync_cache
    async getCache(key) {
      const e = cache.get(key);
      return e ? { ...e } : null;
    },
    async putCache(entry) {
      cache.set(entry.key, { ...entry });
    },
    async markChanged(prefixes) {
      let n = 0;
      for (const [key, e] of cache) {
        if (prefixes.some((p) => key.startsWith(p))) {
          e.changed = true;
          n += 1;
        }
      }
      return n;
    },
    // repos
    async getRepoByGhId(ghRepoId) {
      return [...repos.values()].find((r) => r.gh_repo_id === ghRepoId) || null;
    },
    async getRepoByName(owner, name) {
      const o = owner.toLowerCase();
      const n = name.toLowerCase();
      return [...repos.values()].find((r) => r.gh_owner.toLowerCase() === o && r.gh_name.toLowerCase() === n) || null;
    },
    async upsertRepo(row) {
      const existing = [...repos.values()].find((r) => r.gh_repo_id === row.gh_repo_id);
      const merged = { ...(existing || { id: `repo-${nextId++}` }), ...row };
      repos.set(merged.id, merged);
      return { ...merged };
    },
    async removeInstallation(ghRepoIds) {
      for (const r of repos.values()) if (ghRepoIds.includes(r.gh_repo_id)) r.installation_id = null;
    },
    // observations (snapshots), derived state
    async saveSnapshot(repoId, payload, observedAt, keep = 20) {
      snapshots.push({ repoId, payload, observedAt });
      const mine = snapshots.filter((s) => s.repoId === repoId);
      for (const old of mine.slice(0, Math.max(0, mine.length - keep))) snapshots.splice(snapshots.indexOf(old), 1);
    },
    async latestSnapshot(repoId) {
      const mine = snapshots.filter((s) => s.repoId === repoId);
      return mine.length ? mine[mine.length - 1] : null;
    },
    async replaceState(repoId, payload, refreshedAt) {
      states.set(repoId, payload);
      const r = repos.get(repoId);
      if (r) r.refreshed_at = refreshedAt;
    },
    // webhook_deliveries: true the first time, false for a redelivery
    async recordDelivery(deliveryId, event, receivedAt) {
      if (deliveries.has(deliveryId)) return false;
      deliveries.set(deliveryId, { event, receivedAt });
      return true;
    },
    // test helpers
    _debug: { cache, repos, snapshots, states, deliveries },
  };
}

module.exports = { createMemoryStore };

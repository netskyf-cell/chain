'use strict';
// In-memory cache with a time-to-live, per function instance.
// S0 interim: the demo cache moves to the database in S1 (spec decision 2).
// Time comes from `now()`, injected, so tests control it.

function createCache({ ttlMs, now, maxEntries = 200 }) {
  const entries = new Map();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (now() - hit.at > ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      entries.set(key, { value, at: now() });
    },
  };
}

module.exports = { createCache };

'use strict';
// Fixed-window request limit per client, in memory (CLAUDE.md: rate-limit public endpoints).
// Per function instance only; good enough for a demo endpoint.

function createRateLimit({ limit, windowMs, now, maxClients = 1000 }) {
  const clients = new Map();
  return function allow(clientId) {
    const t = now();
    let entry = clients.get(clientId);
    if (!entry || t - entry.start >= windowMs) {
      if (!entry && clients.size >= maxClients) clients.delete(clients.keys().next().value);
      entry = { start: t, count: 0 };
      clients.set(clientId, entry);
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

module.exports = { createRateLimit };

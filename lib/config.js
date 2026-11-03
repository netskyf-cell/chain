'use strict';
// chain.yml with defaults. Pure: never mutates its input.

const CODE_HOSTS = new Set(['github', 'ado-repos', 'gitlab']);

function withDefaults(config) {
  const c = config || {};
  return {
    team: c.team || null,
    vocabulary: { ...(c.vocabulary || {}) },
    sources: (c.sources || []).map((s) => ({ ...s })),
    roles: c.roles || null,
    rules: {
      stalled_after_days: c.rules?.stalled_after_days ?? 28,
      review_passes: (c.rules?.review_passes ?? ['compliance']).map((p) => String(p).toLowerCase()),
    },
    authorship: {
      agents: (c.authorship?.agents || []).map((a) => ({
        name: a.name,
        accounts: (a.accounts || []).map((x) => x.toLowerCase()),
        branch_prefixes: a.branch_prefixes || [],
        trailers: (a.trailers || []).map((x) => x.toLowerCase()),
      })),
      labels: (c.authorship?.labels || []).map((x) => x.toLowerCase()),
    },
  };
}

// Source ids that feed a role. From chain.yml roles when present; otherwise
// code hosts feed `change` and every other source feeds the decision roles.
function sourcesForRole(config, sources, role) {
  if (config.roles) return [...new Set((config.roles[role] || []).map((m) => m.source))];
  const isHost = (s) => CODE_HOSTS.has(s.system);
  return sources.filter((s) => (role === 'change' ? isHost(s) : !isHost(s))).map((s) => s.id);
}

module.exports = { withDefaults, sourcesForRole };

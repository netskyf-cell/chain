'use strict';
// Helpers shared by the signal rules. Pure: no network, no clock.

const RANK = { high: 3, warn: 2, info: 1 };
const time = (iso) => Date.parse(iso);
const isAccepted = (a) => Boolean(a) && (a.state === 'accepted' || a.state === 'revising');

// History for one path: { partial, commits } or null when it was not read.
function historyOf(ctx, path) {
  const h = ctx.history && ctx.history[path];
  return h && Array.isArray(h.commits) ? h : null;
}

function signal({ kind, severity, rule, message, feature = null, pr = null, evidence }) {
  return { kind, severity, rule, message, feature, pr, evidence };
}

// Most severe first, then most recent, then a stable tie-break.
function compare(a, b) {
  return (
    RANK[b.severity] - RANK[a.severity] ||
    time(b.evidence.at) - time(a.evidence.at) ||
    a.kind.localeCompare(b.kind) ||
    String(a.feature || '').localeCompare(String(b.feature || '')) ||
    String(a.evidence.ref).localeCompare(String(b.evidence.ref))
  );
}

// PRs linked to a feature (kind "feature"), with their raw facts.
function linkedPrs(ctx) {
  return ctx.prs.filter((p) => p.kind === 'feature').map((p) => ({ pr: p, raw: ctx.raw.get(p.number) || {} }));
}

module.exports = { RANK, time, isAccepted, historyOf, signal, compare, linkedPrs };

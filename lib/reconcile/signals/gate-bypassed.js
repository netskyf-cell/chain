'use strict';
// gate_bypassed: a default-branch commit changed an artifact and is in no PR.
// A commit whose PRs were not checked (prs undefined) is never flagged.
const { historyOf, signal } = require('./shared');

const STEPS = ['intent', 'spec', 'plan'];

function gateBypassed(ctx) {
  const out = [];
  for (const f of ctx.features) {
    for (const step of STEPS) {
      const h = historyOf(ctx, f.artifacts[step].path);
      if (!h) continue;
      for (const c of h.commits) {
        if (!Array.isArray(c.prs) || c.prs.length) continue;
        out.push(
          signal({
            kind: 'gate_bypassed',
            severity: 'high',
            rule: 'A commit on the default branch changed an artifact and is contained in no PR',
            message: `${step}.md changed by commit ${c.sha.slice(0, 7)} without a PR`,
            feature: f.slug,
            evidence: { type: 'commit', url: c.url, at: c.date, ref: c.sha },
          }),
        );
      }
    }
  }
  return out;
}

module.exports = { gateBypassed };

'use strict';
// plan_revised (info): a build PR changes plan.md. Never changes health.
const { linkedPrs, signal } = require('./shared');

function planRevised(ctx) {
  const out = [];
  for (const { pr, raw } of linkedPrs(ctx)) {
    if (pr.role !== 'build') continue;
    for (const slug of pr.features) {
      const f = ctx.features.find((x) => x.slug === slug);
      if (!f) continue;
      const plan = f.artifacts.plan.path;
      if (!(raw.files || []).some((x) => x.path === plan || x.previousPath === plan)) continue;
      out.push(
        signal({
          kind: 'plan_revised',
          severity: 'info',
          rule: 'A build PR changes plan.md',
          message: `Build PR #${pr.number} changes plan.md`,
          feature: slug,
          pr: pr.number,
          evidence: { type: 'pr', url: pr.url, at: pr.mergedAt || pr.updatedAt, ref: pr.number },
        }),
      );
    }
  }
  return out;
}

module.exports = { planRevised };

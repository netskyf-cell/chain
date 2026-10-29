'use strict';
// pr_declares_divergence: a linked PR lists divergences from the plan.
// For a merged PR, superseded once plan.md has a commit after the merge;
// skipped when plan.md's history is unknown or partial.
const { parseDivergences } = require('../../parse/pr-body');
const { linkedPrs, historyOf, signal, time } = require('./shared');

function firstLine(text) {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
  return line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '');
}

function prDeclaresDivergence(ctx) {
  const out = [];
  for (const { pr, raw } of linkedPrs(ctx)) {
    const text = parseDivergences(raw.body);
    if (!text) continue;
    for (const slug of pr.features) {
      const f = ctx.features.find((x) => x.slug === slug);
      if (!f) continue;
      if (pr.mergedAt) {
        // Absorbed when a PR that changed plan.md was MERGED after this one: its plan commit
        // may have been written earlier (found live: #40 absorbed #39 with a commit written
        // before #39 merged).
        const planPath = f.artifacts.plan.path;
        const laterPlanMerge = [...ctx.raw.values()].some((m) => m.mergedAt && time(m.mergedAt) > time(pr.mergedAt)
          && (m.files || []).some((x) => x.path === planPath || x.previousPath === planPath));
        if (laterPlanMerge) continue;
        const plan = historyOf(ctx, f.artifacts.plan.path);
        if (!plan || plan.partial) continue; // cannot tell whether the plan absorbed it: say nothing
        if (plan.commits.some((c) => time(c.date) > time(pr.mergedAt))) continue; // absorbed
      }
      out.push(
        signal({
          kind: 'pr_declares_divergence',
          severity: 'warn',
          rule: 'A linked PR lists divergences from the plan, and plan.md has not been updated since its merge',
          message: `PR #${pr.number} diverges from the plan: ${firstLine(text)}`,
          feature: slug,
          pr: pr.number,
          evidence: { type: 'pr', url: pr.url, at: pr.mergedAt || pr.updatedAt, ref: pr.number },
        }),
      );
    }
  }
  return out;
}

module.exports = { prDeclaresDivergence };

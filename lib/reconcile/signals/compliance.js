'use strict';
// compliance_finding: an Important or Block finding of a drift pass
// (default [compliance]) in a review body or inline comment of a linked PR.
const { parseFindings } = require('../../parse/findings');
const { linkedPrs, signal } = require('./shared');

const RAISES = new Set(['Important', 'Block']);

function complianceFinding(ctx) {
  const { passes, drift_passes: driftPasses } = ctx.config.review;
  const drift = new Set(driftPasses);
  const out = [];
  for (const { pr, raw } of linkedPrs(ctx)) {
    const sources = [
      ...(raw.reviews || []).map((r) => ({ type: 'review', body: r.body, url: r.url || pr.url, at: r.submittedAt })),
      ...(raw.comments || []).map((c) => ({ type: 'comment', body: c.body, url: c.url || pr.url, at: c.createdAt })),
    ];
    for (const src of sources) {
      if (!src.at) continue;
      for (const finding of parseFindings(src.body, passes)) {
        if (!drift.has(finding.pass) || !RAISES.has(finding.severity)) continue;
        for (const slug of pr.features) {
          out.push(
            signal({
              kind: 'compliance_finding',
              severity: 'high',
              rule: `A [${finding.pass}] finding at Important or Block on a linked PR`,
              message: `PR #${pr.number} [${finding.pass}] ${finding.severity}: ${finding.text}`,
              feature: slug,
              pr: pr.number,
              evidence: { type: src.type, url: src.url, at: src.at, ref: src.url },
            }),
          );
        }
      }
    }
  }
  return out;
}

module.exports = { complianceFinding };

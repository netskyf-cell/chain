'use strict';
// Criterion not met: the latest compliance review of a merged change has a
// finding at Important or Block.
const { signal } = require('./shared');

const RAISES = new Set(['Important', 'Block']);

module.exports = {
  id: 'criterion-not-met',
  name: 'Criterion not met',
  kind: 'content',
  needs: { block: [], note: ['change'] },
  run(ctx) {
    const out = [];
    for (const c of ctx.merged) {
      const latest = ctx.compliance.get(c.id);
      if (!latest) continue;
      for (const f of latest.findings.filter((x) => RAISES.has(x.severity))) {
        out.push(
          signal({
            rule: this.id,
            kind: this.kind,
            items: [c.id],
            message: `${c.id} [${f.pass}] ${f.severity}: ${f.text}`,
            evidence: [{ item: c.id, url: latest.review.url, at: latest.review.at, criterion: f.criterion }],
            detail: { pass: f.pass, severity: f.severity, criterion: f.criterion, text: f.text },
          }),
        );
      }
    }
    return out;
  },
};

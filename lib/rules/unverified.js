'use strict';
// Unverified: a merged change has no compliance verdict, or only Unverifiable.
const { signal, evidenceOf } = require('./shared');

module.exports = {
  id: 'unverified',
  name: 'Unverified',
  kind: 'content',
  needs: { block: [], note: ['change'] },
  run(ctx) {
    const out = [];
    for (const c of ctx.merged) {
      const latest = ctx.compliance.get(c.id);
      const onlyUnverifiable = latest && latest.findings.every((f) => f.severity === 'Unverifiable');
      if (latest && !onlyUnverifiable) continue;
      out.push(
        signal({
          rule: this.id,
          kind: this.kind,
          items: [c.id],
          message: latest
            ? `${c.id} was merged, but its review could not check it: ${latest.findings[0].text}`
            : `${c.id} was merged with no check against its acceptance criteria`,
          evidence: [latest ? { item: c.id, url: latest.review.url, at: latest.review.at } : evidenceOf(c, { at: c.change.mergedAt ?? null })],
        }),
      );
    }
    return out;
  },
};

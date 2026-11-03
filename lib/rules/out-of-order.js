'use strict';
// Out of order: a merged change links to a plan item that is still open.
const { signal, evidenceOf } = require('./shared');

module.exports = {
  id: 'out-of-order',
  name: 'Out of order',
  kind: 'traceability',
  needs: { block: ['plan'], note: ['change'] },
  run(ctx) {
    const out = [];
    for (const c of ctx.merged) {
      for (const d of ctx.decisionLinks(c)) {
        if (d.role !== 'plan' || d.state !== 'open') continue;
        out.push(
          signal({
            rule: this.id,
            kind: this.kind,
            items: [c.id, d.id],
            message: `${c.id} was merged while ${d.id} "${d.title}" is still ${d.sourceState || d.state}`,
            evidence: [evidenceOf(c, { at: c.change.mergedAt ?? null }), evidenceOf(d)],
          }),
        );
      }
    }
    return out;
  },
};

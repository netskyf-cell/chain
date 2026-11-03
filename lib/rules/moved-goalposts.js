'use strict';
// Moved goalposts: a criterion changed after a change that delivers it was merged.
// Criteria are read on the linked decisions and all their ancestors.
const { signal, evidenceOf } = require('./shared');

module.exports = {
  id: 'moved-goalposts',
  name: 'Moved goalposts',
  kind: 'traceability',
  needs: { block: [], note: ['spec', 'plan', 'change'] },
  run(ctx) {
    const out = [];
    for (const c of ctx.merged) {
      const mergedAt = c.change.mergedAt;
      if (!mergedAt) continue;
      for (const id of [...ctx.under.get(c.id)].sort()) {
        const d = ctx.byId.get(id);
        for (const crit of d.criteria || []) {
          if (!crit.changedAt || Date.parse(crit.changedAt) <= Date.parse(mergedAt)) continue;
          out.push(
            signal({
              rule: this.id,
              kind: this.kind,
              items: [d.id, c.id],
              message: `${d.id} ${crit.id} changed on ${crit.changedAt.slice(0, 10)}, after ${c.id} was merged on ${mergedAt.slice(0, 10)}`,
              evidence: [evidenceOf(d, { criterion: crit.id, at: crit.changedAt }), evidenceOf(c, { at: mergedAt })],
              detail: { criterion: crit.id, changedAt: crit.changedAt, mergedAt },
            }),
          );
        }
      }
    }
    return out;
  },
};

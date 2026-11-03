'use strict';
// Declared divergence: the description of a merged change has a non-empty
// "Divergences from plan" section other than "None".
const { signal, evidenceOf } = require('./shared');
const { parseDivergences } = require('../parse/pr-body');

module.exports = {
  id: 'declared-divergence',
  name: 'Declared divergence',
  kind: 'content',
  needs: { block: [], note: ['change'] },
  run(ctx) {
    const out = [];
    for (const c of ctx.merged) {
      const text = parseDivergences(c.change.body);
      if (!text) continue;
      out.push(
        signal({
          rule: this.id,
          kind: this.kind,
          items: [c.id],
          message: `${c.id} declares: ${text}`,
          evidence: [evidenceOf(c, { at: c.change.mergedAt ?? null })],
        }),
      );
    }
    return out;
  },
};

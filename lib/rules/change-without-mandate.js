'use strict';
// Change without a mandate: a merged change links to no plan, spec or intent item
// (spec D3: a link to a spec or intent counts as a mandate).
const { signal, evidenceOf } = require('./shared');

module.exports = {
  id: 'change-without-mandate',
  name: 'Change without a mandate',
  kind: 'traceability',
  needs: { block: ['intent', 'spec', 'plan'], note: ['change'] },
  run(ctx) {
    return ctx.merged
      .filter((c) => ctx.decisionLinks(c).length === 0)
      .map((c) =>
        signal({
          rule: this.id,
          kind: this.kind,
          items: [c.id],
          message: `${c.id} "${c.title}" was merged with no link to a decision`,
          evidence: [evidenceOf(c, { at: c.change.mergedAt ?? null })],
          detail: {},
        }),
      );
  },
};

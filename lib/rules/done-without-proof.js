'use strict';
// Done without proof: a plan item is done and no merged change links to it.
const { signal, evidenceOf } = require('./shared');

module.exports = {
  id: 'done-without-proof',
  name: 'Done without proof',
  kind: 'traceability',
  needs: { block: ['change'], note: ['plan'] },
  run(ctx) {
    const delivered = new Set(ctx.merged.flatMap((c) => c.links.map((l) => l.to)));
    return ctx.items
      .filter((i) => i.role === 'plan' && i.state === 'done' && !delivered.has(i.id))
      .map((i) =>
        signal({
          rule: this.id,
          kind: this.kind,
          items: [i.id],
          message: `${i.id} "${i.title}" is done, but no merged change links to it`,
          evidence: [evidenceOf(i, { at: i.doneAt ?? null })],
        }),
      );
  },
};

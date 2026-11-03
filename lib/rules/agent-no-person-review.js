'use strict';
// Agent change, no person reviewed: a merged change written by an agent, alone
// or with a person, carries no review by a person (plan P3).
const { signal, evidenceOf } = require('./shared');

module.exports = {
  id: 'agent-no-person-review',
  name: 'Agent change, no person reviewed',
  kind: 'content',
  needs: { block: [], note: ['change'] },
  run(ctx) {
    return ctx.merged
      .filter((c) => ['agent', 'mixed'].includes(ctx.authorship.get(c.id).kind) && !ctx.personReviewed.get(c.id))
      .map((c) => {
        const a = ctx.authorship.get(c.id);
        const who = a.agents.length ? a.agents.join(', ') : 'an agent';
        return signal({
          rule: this.id,
          kind: this.kind,
          items: [c.id],
          message: `${c.id} was written ${a.kind === 'mixed' ? 'partly ' : ''}by ${who} and merged with no review by a person`,
          evidence: [evidenceOf(c, { at: c.change.mergedAt ?? null })],
        });
      });
  },
};

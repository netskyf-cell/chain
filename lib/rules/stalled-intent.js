'use strict';
// Stalled intent: an active intent has had no merged change under it for
// stalled_after_days, counted from the last such merge, or from its creation.
const { signal, evidenceOf, DAY_MS } = require('./shared');

module.exports = {
  id: 'stalled-intent',
  name: 'Stalled intent',
  kind: 'traceability',
  needs: { block: ['change'], note: ['intent'] },
  run(ctx) {
    const limit = ctx.config.rules.stalled_after_days;
    const out = [];
    for (const i of ctx.items.filter((x) => x.role === 'intent' && x.state === 'active')) {
      const merges = ctx.merged.filter((c) => ctx.under.get(c.id).has(i.id) && c.change.mergedAt).map((c) => c.change.mergedAt).sort();
      const since = merges.length ? merges[merges.length - 1] : i.createdAt || i.updatedAt;
      const days = Math.floor((ctx.now - Date.parse(since)) / DAY_MS);
      if (days < limit) continue;
      out.push(
        signal({
          rule: this.id,
          kind: this.kind,
          items: [i.id],
          message: merges.length
            ? `${i.id} "${i.title}" has had no merged change for ${days} days`
            : `${i.id} "${i.title}" has had no merged change since it was created, ${days} days ago`,
          evidence: [evidenceOf(i, { at: since })],
          detail: { days, sinceLastMerge: merges.length > 0 },
        }),
      );
    }
    return out;
  },
};

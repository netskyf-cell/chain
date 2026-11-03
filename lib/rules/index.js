'use strict';
// Runs every rule (contract README, "The rules this contract feeds").
// Pure (ADR-0001): no network, no AI, no clock except collectedAt. Same file
// in, same verdicts out, in a fixed order.
const { sourcesForRole } = require('../config');
const { compareStrings } = require('./shared');

const RULES = [
  require('./done-without-proof'),
  require('./change-without-mandate'),
  require('./out-of-order'),
  require('./moved-goalposts'),
  require('./stalled-intent'),
  require('./criterion-not-met'),
  require('./unverified'),
  require('./declared-divergence'),
  require('./agent-no-person-review'),
];

// Sources a rule needs that were not read (or only partly). A rule whose
// blocking sources are incomplete raises nothing: missing data is not drift.
function coverage(rule, ctx) {
  const unread = (roles) =>
    [...new Set(roles.flatMap((r) => sourcesForRole(ctx.config, ctx.observations.sources, r)))].filter((id) => ctx.incomplete.has(id)).sort();
  return { blocking: unread(rule.needs.block), partial: unread(rule.needs.note) };
}

function runRules(ctx) {
  const signals = [];
  const notChecked = [];
  for (const rule of RULES) {
    const { blocking, partial } = coverage(rule, ctx);
    const sources = [...new Set([...blocking, ...partial])].sort();
    if (sources.length) notChecked.push({ rule: rule.id, name: rule.name, sources, skipped: blocking.length > 0 });
    if (blocking.length) continue;
    const order = RULES.indexOf(rule);
    for (const s of rule.run(ctx)) signals.push({ ...s, name: rule.name, order });
  }
  signals.sort((a, b) => a.order - b.order || compareStrings(a.items.join(' '), b.items.join(' ')) || compareStrings(a.message, b.message));
  return { signals: signals.map(({ order, ...s }) => s), notChecked };
}

module.exports = { RULES, runRules };

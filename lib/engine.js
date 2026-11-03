'use strict';
// One run: observations file + chain.yml in, verdicts out.
// Pure (ADR-0001): no network, no AI, the only clock is collectedAt.
// Same input, byte-identical output (see toJson).

const { withDefaults } = require('./config');
const { buildContext } = require('./rules/shared');
const { runRules } = require('./rules');
const { buildFacts } = require('./facts');

const VERDICTS = 'chain.verdicts/0.1';

function run(observations, rawConfig) {
  const config = withDefaults(rawConfig);
  const ctx = buildContext(observations, config);
  const { signals, notChecked } = runRules(ctx);
  return {
    verdicts: VERDICTS,
    contract: observations.contract,
    team: observations.team,
    collectedAt: observations.collectedAt,
    vocabulary: { ...(observations.vocabulary || {}) },
    sources: observations.sources.map((s) => ({ id: s.id, system: s.system, connector: s.connector ?? null, read: s.read, partial: Boolean(s.partial), reason: s.reason ?? null })),
    signals,
    notChecked,
    facts: buildFacts(ctx),
  };
}

function toJson(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

module.exports = { run, toJson, VERDICTS };

'use strict';
// All S2 drift signals (intent/s2-drift/spec.md, "Signals"). One pure rule per
// file; this runs them and returns one deterministic, sorted list.
const { intentRework } = require('./intent-rework');
const { specRework } = require('./spec-rework');
const { planRevised } = require('./plan-revised');
const { prDeclaresDivergence } = require('./divergence');
const { complianceFinding } = require('./compliance');
const { gateBypassed } = require('./gate-bypassed');
const { lightPathLarge } = require('./light-size');
const { compare } = require('./shared');

const RULES = [intentRework, specRework, planRevised, prDeclaresDivergence, complianceFinding, gateBypassed, lightPathLarge];

function signals(ctx) {
  return RULES.flatMap((rule) => rule(ctx)).sort(compare);
}

module.exports = { signals, RULES };

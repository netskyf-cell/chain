'use strict';
const { rework } = require('./rework');

const specRework = (ctx) => rework(ctx, { kind: 'spec_rework', earlier: 'spec', later: 'plan' });

module.exports = { specRework };

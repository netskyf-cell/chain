'use strict';
const { rework } = require('./rework');

const intentRework = (ctx) => rework(ctx, { kind: 'intent_rework', earlier: 'intent', later: 'spec' });

module.exports = { intentRework };

'use strict';
// AC-1: reading the Feature:, Light change: and Capability: lines of a PR body.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrBody } = require('../lib/parse/pr-body');

test('reads a feature PR', () => {
  assert.deepEqual(parsePrBody('## Type\n\nFeature: s1-state\n\nCapability: flow-visibility\n'), {
    feature: 's1-state', light: null, capability: 'flow-visibility',
  });
});

test('reads a light change with its reason', () => {
  assert.deepEqual(parsePrBody('Light change: fix a typo in the README\nCapability: alpha'), {
    feature: null, light: 'fix a typo in the README', capability: 'alpha',
  });
});

test('ignores template placeholders in angle brackets', () => {
  const template = 'Feature: <slug>\nLight change: <one-line reason: a small fix>\nCapability: <slug, optional>';
  assert.deepEqual(parsePrBody(template), { feature: null, light: null, capability: null });
});

test('ignores lines inside HTML comments', () => {
  const body = '<!-- Feature: hidden\nLight change: also hidden -->\nFeature: visible';
  assert.deepEqual(parsePrBody(body), { feature: 'visible', light: null, capability: null });
});

test('ignores empty values and is case-insensitive on the label', () => {
  assert.deepEqual(parsePrBody('feature:   \nLIGHT CHANGE: bump yaml'), { feature: null, light: 'bump yaml', capability: null });
});

test('takes the first real value and handles Windows line endings', () => {
  assert.deepEqual(parsePrBody('Feature: <slug>\r\nFeature: first\r\nFeature: second\r\n'), {
    feature: 'first', light: null, capability: null,
  });
});

test('null, undefined and empty bodies give all nulls', () => {
  for (const body of [null, undefined, '']) {
    assert.deepEqual(parsePrBody(body), { feature: null, light: null, capability: null });
  }
});

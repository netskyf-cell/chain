'use strict';
// AC-1: reading the Feature:, Light change: and Capability: lines of a PR body.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrBody } = require('../lib/parse/pr-body');

test('reads a feature PR', () => {
  assert.deepEqual(parsePrBody('## Type\n\nFeature: s1-state\n\nCapability: flow-visibility\n'), {
    feature: 's1-state', light: null, capability: 'flow-visibility', planComplete: false,
  });
});

test('reads a light change with its reason', () => {
  assert.deepEqual(parsePrBody('Light change: fix a typo in the README\nCapability: alpha'), {
    feature: null, light: 'fix a typo in the README', capability: 'alpha', planComplete: false,
  });
});

test('ignores template placeholders in angle brackets', () => {
  const template = 'Feature: <slug>\nLight change: <one-line reason: a small fix>\nCapability: <slug, optional>';
  assert.deepEqual(parsePrBody(template), { feature: null, light: null, capability: null, planComplete: false });
});

test('ignores lines inside HTML comments', () => {
  const body = '<!-- Feature: hidden\nLight change: also hidden -->\nFeature: visible';
  assert.deepEqual(parsePrBody(body), { feature: 'visible', light: null, capability: null, planComplete: false });
});

test('ignores empty values and is case-insensitive on the label', () => {
  assert.deepEqual(parsePrBody('feature:   \nLIGHT CHANGE: bump yaml'), { feature: null, light: 'bump yaml', capability: null, planComplete: false });
});

test('takes the first real value and handles Windows line endings', () => {
  assert.deepEqual(parsePrBody('Feature: <slug>\r\nFeature: first\r\nFeature: second\r\n'), {
    feature: 'first', light: null, capability: null, planComplete: false,
  });
});

test('null, undefined and empty bodies give all nulls', () => {
  for (const body of [null, undefined, '']) {
    assert.deepEqual(parsePrBody(body), { feature: null, light: null, capability: null, planComplete: false });
  }
});

test('Plan complete: yes marks the last build PR of a plan', () => {
  assert.equal(parsePrBody('Feature: x\nPlan complete: yes').planComplete, true);
  assert.equal(parsePrBody('Feature: x\nplan complete: Yes').planComplete, true);
  assert.equal(parsePrBody('Feature: x\nPlan complete: no').planComplete, false);
  assert.equal(parsePrBody('Plan complete: <yes on the last build PR of a plan, otherwise delete this line>').planComplete, false);
});

// AC-2 (S2): the "Divergences from plan" section.
const { parseDivergences } = require('../lib/parse/pr-body');

test('parseDivergences returns the section text', () => {
  const body = '## Plan match\n\nYes.\n\n## Divergences from plan\n\n- Added a helper file.\n- Renamed a step.\n\n## Verification\n\nTests.';
  assert.equal(parseDivergences(body), '- Added a helper file.\n- Renamed a step.');
});

test('parseDivergences: None, n/a, empty, comments only or no heading mean nothing declared', () => {
  const section = (s) => `## Divergences from plan\n\n${s}\n\n## Verification\n`;
  for (const s of ['None', 'none.', 'N/A', '', '<!-- Write "None" if ... -->', '<!-- note -->\n\nNone']) {
    assert.equal(parseDivergences(section(s)), null, `expected null for ${JSON.stringify(s)}`);
  }
  assert.equal(parseDivergences('Feature: x\n\nNo heading here.'), null);
  assert.equal(parseDivergences(null), null);
});

test('parseDivergences works when the section is last and with Windows line endings', () => {
  assert.equal(parseDivergences('## Divergences from plan\r\n\r\nSkipped step 3.\r\n'), 'Skipped step 3.');
});

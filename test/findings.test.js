'use strict';
// AC-1: review findings in the REVIEW.md format "[pass] Severity: text".
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFindings } = require('../lib/parse/findings');

const PASSES = ['bugs', 'security', 'compliance'];

test('reads one finding per line', () => {
  const text = [
    'Summary of the review.',
    '[compliance] Important: AC-3 not met (lib/x.js:12)',
    '- [bugs] Nit: rename variable',
    '[SECURITY] block: token in a log line',
  ].join('\n');
  assert.deepEqual(parseFindings(text, PASSES), [
    { pass: 'compliance', severity: 'Important', text: 'AC-3 not met (lib/x.js:12)' },
    { pass: 'bugs', severity: 'Nit', text: 'rename variable' },
    { pass: 'security', severity: 'Block', text: 'token in a log line' },
  ]);
});

test('ignores lines inside code blocks', () => {
  const text = 'Example:\n```\n[compliance] Important: this is an example\n```\n[compliance] Block: real one';
  assert.deepEqual(parseFindings(text, PASSES).map((f) => f.text), ['real one']);
});

test('ignores unknown passes, unknown severities and malformed lines', () => {
  const text = [
    '[style] Important: not a pass',
    '[compliance] Critical: not a severity',
    '[compliance]Important: missing space is fine',
    '[compliance] Important',
    'compliance Important: no brackets',
  ].join('\n');
  assert.deepEqual(parseFindings(text, PASSES), [
    { pass: 'compliance', severity: 'Important', text: 'missing space is fine' },
  ]);
});

test('empty and non-string input give no findings', () => {
  for (const v of [null, undefined, '', 42]) assert.deepEqual(parseFindings(v, PASSES), []);
});

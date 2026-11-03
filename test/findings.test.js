'use strict';
// Ported from chain-v1 (test/findings.test.js), extended for Met, Unverifiable
// and criterion ids (spec AC-E3).
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFindings, hasUntaggedText } = require('../lib/parse/findings');

const PASSES = ['bugs', 'security', 'compliance'];

test('reads one finding per line', () => {
  const text = [
    'Summary of the review.',
    '[compliance] Important: AC-3 not met (lib/x.js:12)',
    '- [bugs] Nit: rename variable',
    '[SECURITY] block: token in a log line',
  ].join('\n');
  assert.deepEqual(parseFindings(text, PASSES), [
    { pass: 'compliance', severity: 'Important', criterion: 'AC-3', text: 'AC-3 not met (lib/x.js:12)' },
    { pass: 'bugs', severity: 'Nit', criterion: null, text: 'rename variable' },
    { pass: 'security', severity: 'Block', criterion: null, text: 'token in a log line' },
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
    { pass: 'compliance', severity: 'Important', criterion: null, text: 'missing space is fine' },
  ]);
});

test('empty and non-string input give no findings', () => {
  for (const v of [null, undefined, '', 42]) assert.deepEqual(parseFindings(v, PASSES), []);
});

test('reads Met and Unverifiable, any case, with the criterion id', () => {
  const text = '[compliance] met: ac-1 CSV works\n[compliance] Unverifiable: no criteria linked';
  assert.deepEqual(parseFindings(text, PASSES), [
    { pass: 'compliance', severity: 'Met', criterion: 'AC-1', text: 'ac-1 CSV works' },
    { pass: 'compliance', severity: 'Unverifiable', criterion: null, text: 'no criteria linked' },
  ]);
});

test('hasUntaggedText tells a written review from tagged lines only', () => {
  assert.equal(hasUntaggedText('[compliance] Met: AC-1 ok\n\n[compliance] Important: AC-2 missing'), false);
  assert.equal(hasUntaggedText('Looks good, one question on the export.\n[compliance] Met: AC-1 ok'), true);
  assert.equal(hasUntaggedText('```\nnot counted\n```'), false);
  assert.equal(hasUntaggedText(''), false);
});

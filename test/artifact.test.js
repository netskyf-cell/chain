'use strict';
// AC-1: frontmatter parser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFrontmatter } = require('../lib/parse/artifact');

test('reads fields between the first two --- lines', () => {
  const text = '---\nslug: alpha\ncapability: flow-visibility\n---\n# Title\n';
  assert.deepEqual(parseFrontmatter(text), { slug: 'alpha', capability: 'flow-visibility' });
});

test('reads nested maps such as links', () => {
  const text = '---\nlinks:\n  jira: PROJ-1\n  linear: ENG-2\n---\nbody';
  assert.deepEqual(parseFrontmatter(text), { links: { jira: 'PROJ-1', linear: 'ENG-2' } });
});

test('handles Windows line endings', () => {
  assert.deepEqual(parseFrontmatter('---\r\nslug: a\r\n---\r\nbody'), { slug: 'a' });
});

test('returns {} when there is no frontmatter', () => {
  assert.deepEqual(parseFrontmatter('# Just a title\n'), {});
  assert.deepEqual(parseFrontmatter(''), {});
});

test('returns {} when the closing --- is missing', () => {
  assert.deepEqual(parseFrontmatter('---\nslug: a\n# no end'), {});
});

test('returns {} for malformed YAML and does not throw', () => {
  assert.deepEqual(parseFrontmatter('---\nslug: [unclosed\n---\n'), {});
});

test('returns {} when the YAML is not a map', () => {
  assert.deepEqual(parseFrontmatter('---\n- a\n- b\n---\n'), {});
  assert.deepEqual(parseFrontmatter('---\njust text\n---\n'), {});
});

test('returns {} for non-string input', () => {
  assert.deepEqual(parseFrontmatter(undefined), {});
  assert.deepEqual(parseFrontmatter(null), {});
});

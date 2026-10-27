'use strict';
// AC-2 to AC-5 and AC-13: scan() turns a file list into Chain's model.
const test = require('node:test');
const assert = require('node:assert/strict');
const { scan } = require('../lib/scan');
const { fixtureRepo } = require('./helpers');

test('conventional repo: exact model', async () => {
  const model = await scan(fixtureRepo('conventional'));

  assert.deepEqual(model.paths, { capabilities: 'capabilities', intent: 'intent' });
  assert.equal(model.empty, false);

  assert.deepEqual(model.capabilities, [
    { slug: 'alpha', path: 'capabilities/alpha.md', statement: 'Builder can see alpha', features: ['full'] },
    { slug: 'beta', path: 'capabilities/beta.md', statement: 'Team can see beta.', features: ['intent-only'] },
    { slug: 'gamma', path: 'capabilities/gamma.md', statement: null, features: [] },
  ]);

  assert.deepEqual(model.features, [
    {
      slug: 'full',
      capability: 'alpha',
      artifacts: {
        intent: { state: 'present', path: 'intent/full/intent.md' },
        spec: { state: 'present', path: 'intent/full/spec.md' },
        plan: { state: 'present', path: 'intent/full/plan.md' },
      },
    },
    {
      slug: 'intent-only',
      capability: 'beta',
      artifacts: {
        intent: { state: 'present', path: 'intent/intent-only/intent.md' },
        spec: { state: 'absent', path: 'intent/intent-only/spec.md' },
        plan: { state: 'absent', path: 'intent/intent-only/plan.md' },
      },
    },
    {
      slug: 'no-frontmatter',
      capability: null,
      artifacts: {
        intent: { state: 'present', path: 'intent/no-frontmatter/intent.md' },
        spec: { state: 'present', path: 'intent/no-frontmatter/spec.md' },
        plan: { state: 'absent', path: 'intent/no-frontmatter/plan.md' },
      },
    },
    {
      slug: 'orphan',
      capability: 'does-not-exist',
      artifacts: {
        intent: { state: 'present', path: 'intent/orphan/intent.md' },
        spec: { state: 'absent', path: 'intent/orphan/spec.md' },
        plan: { state: 'absent', path: 'intent/orphan/plan.md' },
      },
    },
  ]);

  // AC-4: missing or unknown capability goes to unassigned.
  assert.deepEqual(model.unassigned, ['no-frontmatter', 'orphan']);
});

test('files directly under intent/ (like README.md) are not features', async () => {
  const model = await scan(fixtureRepo('conventional'));
  assert.ok(!model.features.some((f) => f.slug === 'README.md'));
});

test('AC-3: paths come from chain.yml when present', async () => {
  const model = await scan(fixtureRepo('conventional-custom-paths'));
  assert.deepEqual(model.paths, { capabilities: 'docs/caps', intent: 'work' });
  assert.deepEqual(model.capabilities.map((c) => c.slug), ['one']);
  assert.deepEqual(model.features.map((f) => [f.slug, f.capability]), [['feat', 'one']]);
  assert.deepEqual(model.capabilities[0].features, ['feat']);
});

test('AC-13: a repo without the convention returns an empty model, not an error', async () => {
  const model = await scan(fixtureRepo('no-convention'));
  assert.equal(model.empty, true);
  assert.deepEqual(model.capabilities, []);
  assert.deepEqual(model.features, []);
  assert.deepEqual(model.unassigned, []);
});

test('a malformed chain.yml falls back to default paths', async () => {
  const repo = {
    files: ['chain.yml', 'capabilities/x.md'],
    read: async (p) => (p === 'chain.yml' ? 'paths: [broken' : '> X statement'),
  };
  const model = await scan(repo);
  assert.deepEqual(model.paths, { capabilities: 'capabilities', intent: 'intent' });
  assert.equal(model.capabilities[0].statement, 'X statement');
});

test('same input gives the same output (deterministic)', async () => {
  const a = await scan(fixtureRepo('conventional'));
  const b = await scan(fixtureRepo('conventional'));
  assert.deepEqual(a, b);
});

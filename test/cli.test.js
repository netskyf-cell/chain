'use strict';
// bin/chain.js: validate, compare, rules (spec AC-C6, AC-E2, AC-I3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { example, root } = require('./helpers');

const chain = (...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'chain.js'), ...args], { cwd: root, encoding: 'utf8' });
const exampleFile = path.join('examples', 'observations.example.json');
const configFile = path.join('examples', 'chain.example.yml');

function tmp(name, data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}

test('validate: ok on the example, exit 1 with reasons on a broken file', () => {
  assert.equal(chain('validate', exampleFile).status, 0);
  assert.equal(chain('validate', '--config', configFile).status, 0);
  const broken = example();
  broken.items[0].links.push({ to: 'ado:999', via: 'url' });
  const r = chain('validate', tmp('o.json', broken));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /link to ado:999/);
});

test('validate: a missing file is a usage error', () => {
  const r = chain('validate', 'nope.json');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /File not found/);
});

test('compare: same despite order and collection time; different with reasons', () => {
  const reordered = example();
  reordered.collectedAt = '2026-11-02T11:00:00Z';
  reordered.items.reverse();
  reordered.items.find((i) => i.id === 'gh:41').change.reviews.reverse();
  assert.equal(chain('compare', exampleFile, tmp('b.json', reordered)).status, 0);

  const changed = example();
  changed.items.find((i) => i.id === 'ado:113').state = 'active';
  changed.items.pop();
  const r = chain('compare', exampleFile, tmp('c.json', changed));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /item ado:113: state differ/);
  assert.match(r.stdout, /item gh:43: only in the first file/);
});

test('compare: criteria order matters', () => {
  const swapped = example();
  swapped.items.find((i) => i.id === 'ado:110').criteria.reverse();
  assert.equal(chain('compare', exampleFile, tmp('d.json', swapped)).status, 1);
});

test('rules: prints verdicts, twice the same', () => {
  const a = chain('rules', exampleFile, '--config', configFile);
  const b = chain('rules', exampleFile, '--config', configFile);
  assert.equal(a.status, 0);
  assert.equal(a.stdout, b.stdout);
  const out = JSON.parse(a.stdout);
  assert.equal(out.verdicts, 'chain.verdicts/0.1');
  assert.equal(out.signals.length, 10);
});

test('rules: --out writes the file', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chain-')), 'chain', 'verdicts.json');
  const r = chain('rules', exampleFile, '--config', configFile, '--out', out);
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).team, 'Fleet Portal');
});

test('rules: refuses an invalid observations file', () => {
  const broken = example();
  broken.contract = 'chain.observations/0.1';
  assert.equal(chain('rules', tmp('e.json', broken), '--config', configFile).status, 1);
});

test('rules: without chain.yml, runs on defaults and says so', () => {
  const r = chain('rules', exampleFile, '--config', 'missing.yml');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /using defaults/);
});

test('package declares Node 20+ and the chain command', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.engines.node, '>=20');
  assert.equal(pkg.bin.chain, 'bin/chain.js');
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['ajv', 'ajv-formats', 'yaml']);
});

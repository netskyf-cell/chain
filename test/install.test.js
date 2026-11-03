'use strict';
// Plan E1 (spec AC-I1): chain install writes the three agents where each
// coding agent reads them, and nothing else. README and benchmark guide (E2, E3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { adapters } = require('../scripts/build-adapters');
const { root } = require('./helpers');

const chain = (cwd, ...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'chain.js'), ...args], { cwd, encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chain-install-'));

function files(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(path.relative(dir, path.join(entry.parentPath || entry.path, entry.name)).split(path.sep).join('/'));
  }
  return out.sort();
}

test('copilot: three agents in .github/agents, nothing else', () => {
  const dir = tmp();
  const r = chain(dir, 'install', '--target', 'copilot');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(files(dir), ['.github/agents/chain-collector.agent.md', '.github/agents/chain-compliance-review.agent.md', '.github/agents/chain-setup.agent.md']);
});

test('claude: three agents in .claude/agents, nothing else', () => {
  const dir = tmp();
  assert.equal(chain(dir, 'install', '--target', 'claude').status, 0);
  assert.deepEqual(files(dir), ['.claude/agents/chain-collector.md', '.claude/agents/chain-compliance-review.md', '.claude/agents/chain-setup.md']);
});

test('installed files equal the adapters', () => {
  const dir = tmp();
  chain(dir, 'install', '--target', 'copilot');
  for (const a of adapters().filter((x) => x.target === 'copilot')) {
    assert.equal(fs.readFileSync(path.join(dir, a.installPath), 'utf8'), a.content);
  }
});

test('--dir installs into another folder', () => {
  const dir = tmp();
  assert.equal(chain(root, 'install', '--target', 'claude', '--dir', dir).status, 0);
  assert.equal(files(dir).length, 3);
});

test('installing twice changes nothing', () => {
  const dir = tmp();
  chain(dir, 'install', '--target', 'copilot');
  const r = chain(dir, 'install', '--target', 'copilot');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /same \.github\/agents\/chain-setup\.agent\.md/);
});

test('a file the team changed is kept unless --force', () => {
  const dir = tmp();
  chain(dir, 'install', '--target', 'copilot');
  const file = path.join(dir, '.github', 'agents', 'chain-setup.agent.md');
  fs.writeFileSync(file, 'our own version');
  const kept = chain(dir, 'install', '--target', 'copilot');
  assert.equal(kept.status, 1);
  assert.match(kept.stdout, /kept .*chain-setup\.agent\.md/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'our own version');
  assert.equal(chain(dir, 'install', '--target', 'copilot', '--force').status, 0);
  assert.notEqual(fs.readFileSync(file, 'utf8'), 'our own version');
});

test('an unknown target or missing folder is a usage error', () => {
  assert.equal(chain(tmp(), 'install', '--target', 'gitlab').status, 2);
  assert.equal(chain(tmp(), 'install').status, 2);
  const r = chain(root, 'install', '--target', 'claude', '--dir', '/no/such/folder');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Folder not found/);
});

test('the package ships what a team needs, not tests or examples', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const f of ['bin/', 'lib/', 'agents/', 'adapters/', 'docs/contract/']) assert.ok(pkg.files.includes(f), f);
  assert.ok(!pkg.files.some((f) => f.startsWith('test') || f.startsWith('examples')));
});

test('E2: the README walks from connectors to board, with the admin policies', () => {
  const text = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const steps = ['### 1. Check your connectors', '### 2. Install the pack', '### 3. Run the setup agent', '### 4. Collect and open the board'];
  const at = steps.map((s) => text.indexOf(s));
  assert.ok(at.every((i) => i > 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  for (const s of ['MCP servers in Copilot', 'npx chain install --target copilot', 'npx chain board', 'X-MCP-Readonly']) assert.ok(text.includes(s), s);
});

test('E3: the benchmark guide has the bar, the method and a sheet for 5 PRs', () => {
  const text = fs.readFileSync(path.join(root, 'docs', 'benchmark.md'), 'utf8');
  assert.match(text, /At least 1/);
  assert.match(text, /Under 30%/);
  assert.equal((text.match(/^\| [1-5] \|/gm) || []).length, 5);
});

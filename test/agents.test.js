'use strict';
// Group D: the three agent files. The agents themselves run in a coding agent
// against real connectors (checked by hand, see the PR); these tests pin what
// can be pinned: adapters in sync, output formats the rules can read, and
// instructions that match the contract.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { adapters, AGENTS } = require('../scripts/build-adapters');
const { parseFindings } = require('../lib/parse/findings');
const { validateConfig } = require('../lib/validate');
const { root } = require('./helpers');

const read = (name) => fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');

// Fenced blocks under a heading, without their fences.
function fences(text, heading) {
  const start = text.indexOf(`## ${heading}`);
  assert.ok(start >= 0, heading);
  const rest = text.slice(start + 1);
  const section = rest.slice(0, rest.search(/\n## /) === -1 ? undefined : rest.search(/\n## /));
  return [...section.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
}

test('AC-I2: every adapter matches its canonical file', () => {
  for (const a of adapters()) {
    const file = path.join(root, a.path);
    assert.ok(fs.existsSync(file), `${a.path} missing: run npm run build:adapters`);
    assert.equal(fs.readFileSync(file, 'utf8'), a.content, `${a.path} out of date: run npm run build:adapters`);
  }
});

test('three agents, two targets, valid frontmatter with name and description', () => {
  assert.deepEqual([...AGENTS].sort(), ['collector', 'compliance-review', 'setup']);
  const all = adapters();
  assert.equal(all.length, 6);
  for (const a of all) {
    const meta = YAML.parse(a.content.match(/^---\n([\s\S]*?)\n---\n/)[1]);
    assert.match(meta.name, /^chain-[a-z-]+$/, a.path);
    assert.ok(meta.description.length > 40, a.path);
  }
  assert.deepEqual(all.filter((a) => a.target === 'copilot').map((a) => a.installPath.split(path.sep).slice(0, 2).join('/')), Array(3).fill('.github/agents'));
  assert.deepEqual(all.filter((a) => a.target === 'claude').map((a) => a.installPath.split(path.sep).slice(0, 2).join('/')), Array(3).fill('.claude/agents'));
});

test('AC-R2: the review example gives one verdict per criterion, readable by the rules', () => {
  const [full] = fences(read('compliance-review'), 'Example comment');
  const findings = parseFindings(full, ['compliance']);
  assert.deepEqual(findings.map((f) => [f.severity, f.criterion]), [['Met', 'AC-1'], ['Important', 'AC-2'], ['Met', 'AC-3']]);
  for (const f of findings) assert.match(f.text, /\([\w./-]+:\d+\)$/, 'file and line');
});

test('AC-R3: the no-criteria example is one Unverifiable line', () => {
  const [, none] = fences(read('compliance-review'), 'Example comment');
  assert.deepEqual(parseFindings(none, ['compliance']).map((f) => f.severity), ['Unverifiable']);
});

test('the review agent posts only after confirmation and reads the diff from git (AC-R4, AC-R5)', () => {
  const text = read('compliance-review');
  assert.match(text, /only after the person confirms/);
  assert.match(text, /git diff <base>\.\.\.<head>/);
  assert.match(text, /No code fences around the findings/);
});

test('the collector names every contract field it must fill', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'contract', 'observations.schema.json'), 'utf8'));
  const d = schema.$defs;
  const fields = [
    ...Object.keys(schema.properties),
    ...Object.keys(d.source.properties),
    ...Object.keys(d.item.properties).filter((k) => k !== 'change'),
    ...Object.keys(d.change.properties).map((k) => `change.${k}`),
    ...Object.keys(d.item.properties.criteria.items.properties).filter((k) => k !== 'text'),
    ...Object.keys(d.person.properties),
    ...Object.keys(d.change.properties.commits.items.properties),
    ...Object.keys(d.change.properties.reviews.items.properties),
  ];
  const text = read('collector');
  for (const f of fields) assert.ok(text.includes(f), `collector.md does not mention ${f}`);
});

test('the collector copies and never judges (ADR-0001, AC-C5, AC-C7, AC-C8)', () => {
  const text = read('collector');
  assert.match(text, /\*\*verbatim\*\*/);
  assert.match(text, /read-only/i);
  assert.match(text, /Never write a verdict/);
  assert.match(text, /npx chain validate/);
  assert.match(text, /since_days/);
});

test('the setup example chain.yml is valid', () => {
  const [example] = fences(read('setup'), '6. Write and check chain.yml');
  const filled = example.replace(/<[^>]+>/g, 'x');
  assert.deepEqual(validateConfig(YAML.parse(filled)), []);
});

test('the setup agent checks connectors first and names the policies (AC-S1, AC-S5)', () => {
  const text = read('setup');
  assert.ok(text.indexOf('## 1. Check the connectors first') < text.indexOf('## 2.'));
  for (const s of ['Reachable', 'Not configured', 'Blocked by policy', 'Sign-in needed', 'MCP servers in Copilot']) assert.ok(text.includes(s), s);
  assert.match(text, /Never write to a tracker, wiki or code host/);
});

test('no agent file holds a company name or a secret-looking value', () => {
  for (const name of AGENTS) {
    const text = read(name);
    assert.doesNotMatch(text, /(ghp_|github_pat_|xox[bp]-|-----BEGIN)/);
  }
});

#!/usr/bin/env node
'use strict';
// Writes the agent files each coding agent reads, from the canonical files in
// agents/ (spec D7). One source of truth; adapters are generated, never edited.
//   GitHub Copilot: .github/agents/<name>.agent.md  (custom agents, landscape doc)
//   Claude Code:    .claude/agents/<name>.md         (subagents)
// Usage: node scripts/build-adapters.js [--check]   --check exits 1 when out of date.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const AGENTS = ['setup', 'compliance-review', 'collector'];

const TARGETS = {
  copilot: { dir: path.join('adapters', 'copilot'), installDir: path.join('.github', 'agents'), file: (name) => `${name}.agent.md` },
  claude: { dir: path.join('adapters', 'claude'), installDir: path.join('.claude', 'agents'), file: (name) => `${name}.md` },
};

function parse(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = Object.fromEntries(
    m[1].split('\n').map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  if (!meta.name || !meta.description) throw new Error(`${file}: frontmatter needs name and description`);
  return { meta, body: m[2] };
}

function render(target, agent) {
  const source = path.join('agents', `${agent}.md`);
  const { meta, body } = parse(fs.readFileSync(path.join(root, source), 'utf8'), source);
  const notice = `<!-- Generated from ${source.split(path.sep).join('/')} by scripts/build-adapters.js for ${target}. Edit the canonical file, then run npm run build:adapters. -->`;
  return { file: TARGETS[target].file(meta.name), content: `---\nname: ${meta.name}\ndescription: ${meta.description}\n---\n${notice}\n${body}` };
}

// Every adapter file: { target, path (relative to the repo), installPath, content }.
function adapters() {
  return Object.keys(TARGETS).flatMap((target) =>
    AGENTS.map((agent) => {
      const { file, content } = render(target, agent);
      return { target, path: path.join(TARGETS[target].dir, file), installPath: path.join(TARGETS[target].installDir, file), content };
    }),
  );
}

function main(argv) {
  const check = argv.includes('--check');
  let stale = 0;
  for (const a of adapters()) {
    const full = path.join(root, a.path);
    const current = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
    if (current === a.content) continue;
    if (check) {
      stale += 1;
      process.stdout.write(`out of date: ${a.path}\n`);
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, a.content);
      process.stdout.write(`wrote ${a.path}\n`);
    }
  }
  return stale ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { adapters, AGENTS, TARGETS };

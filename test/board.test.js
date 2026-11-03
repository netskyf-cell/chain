'use strict';
// Spec AC-B1 to AC-B5 and plan C5: the board.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run } = require('../lib/engine');
const { renderBoard, plural, article, esc } = require('../lib/board/render');
const { example, config, root } = require('./helpers');

const board = (obs = example(), cfg = config()) => renderBoard(run(obs, cfg), obs);

// Text a reader sees: no tags, no style, no embedded data.
function visible(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
}

test('AC-B1: one self-contained page, no external request', () => {
  const html = board();
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<link\b|<img\b|<iframe\b|@import|url\(/i);
  assert.doesNotMatch(html, /\bsrc=/i, 'nothing loaded');
  assert.doesNotMatch(html.replace(/<script type="application\/json"[\s\S]*?<\/script>/, ''), /<script/i, 'no script runs');
  const hrefs = [...html.matchAll(/<(\w+)[^>]*\bhref="([^"]*)"/g)];
  assert.ok(hrefs.length > 0);
  for (const [, tag, url] of hrefs) {
    assert.equal(tag, 'a', 'only links carry URLs');
    assert.match(url, /^https?:\/\//);
  }
  assert.match(html, /Content-Security-Policy" content="default-src 'none'/);
});

test('AC-B1: the verdicts are embedded and cannot break out of their tag', () => {
  const obs = example();
  obs.items.find((i) => i.id === 'gh:42').title = '</script><script>alert(1)</script>';
  const html = board(obs);
  assert.equal((html.match(/<script/g) || []).length, 1);
  const data = JSON.parse(html.match(/<script type="application\/json" id="chain-verdicts">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.verdicts, 'chain.verdicts/0.1');
});

test('titles and texts from sources are escaped', () => {
  const obs = example();
  obs.items.find((i) => i.id === 'ado:112').title = '<b onmouseover="x">bold</b>';
  const html = board(obs);
  assert.doesNotMatch(html, /<b onmouseover/);
  assert.match(html, /&lt;b onmouseover=&quot;x&quot;&gt;bold&lt;\/b&gt;/);
});

test('a non-http source URL is shown as text, not a link', () => {
  const obs = example();
  obs.items.find((i) => i.id === 'ado:112').url = 'javascript:alert(1)';
  assert.doesNotMatch(board(obs), /href="javascript:/);
});

test('AC-B2: the summary, each chain, code with no decision, then who built it', () => {
  const html = board();
  const order = ['The chain breaks in', 'Each Epic, from decision to code', 'Code with no Epic', 'Who built it, and who checked it'];
  const at = order.map((h) => html.indexOf(h));
  assert.ok(at.every((i) => i > 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
});

test('AC-B2: every signal appears once', () => {
  const html = board();
  assert.equal((html.match(/<li class="signal /g) || []).length, run(example(), config()).signals.length);
});

test('AC-B3: the team words appear and the role names never do', () => {
  const obs = example();
  obs.vocabulary = { group: 'Quest', intent: 'Quest', spec: 'Scroll', plan: 'Task', change: 'Patch' };
  for (const i of obs.items) delete i.type;
  const text = visible(board(obs));
  for (const w of ['Quest', 'Scroll', 'Task', 'Patch']) assert.match(text, new RegExp(`\\b${w}`), w);
  assert.doesNotMatch(text, /\b(intent|spec|plan|change)s?\b/i);
});

test('AC-B3: without a vocabulary, neutral words are used, not role names', () => {
  const obs = example();
  delete obs.vocabulary;
  for (const i of obs.items) delete i.type;
  const cfg = config();
  delete cfg.vocabulary;
  const text = visible(board(obs, cfg));
  assert.match(text, /Each Goal, from decision to code/);
  assert.doesNotMatch(text, /\b(intent|spec|plan|change)s?\b/i);
});

test('AC-B4: unread sources and skipped rules are at the top, in plain words', () => {
  const obs = example();
  Object.assign(obs.sources.find((s) => s.id === 'adorepos'), { read: false, reason: 'No Azure DevOps Repos connector is configured.' });
  const html = board(obs);
  const top = html.indexOf('Some sources were not fully read');
  assert.ok(top > 0 && top < html.indexOf('The chain breaks in'));
  assert.match(html, /Azure Repos \(adorepos\) was not read: No Azure DevOps Repos connector is configured\./);
  assert.match(html, /Not checked:<\/strong> Done without proof, because adorepos was not fully read/);
  assert.match(html, /Partly checked:<\/strong> Unverified covers only what was read from adorepos/);
});

test('AC-B4: no banner when everything was read', () => {
  assert.doesNotMatch(board(), /not fully read|Not checked|Partly checked/);
});

test('AC-B5: every signal links to its evidence in the source tool', () => {
  const html = board();
  const cards = html.match(/<li class="signal [\s\S]*?<\/li>/g);
  for (const card of cards) assert.match(card, /Evidence: <a href="https?:\/\//, card.slice(0, 120));
});

test('each chain is titled by its group item and shows where it started and its route', () => {
  const text = visible(board()).replace(/\s+/g, ' ');
  assert.match(text, /Driver self-service \d+ breaks Started in Confluence, 2026-08-25 Confluence → Azure DevOps → GitHub 2 of 3 User Stories done 67% of commits by agents/);
  assert.match(text, /Maintenance planner 1 break Started in Azure DevOps, 2026-07-01 Azure DevOps Epics/);
});

test('the chain has four stations in team words, and an empty one says so', () => {
  const text = visible(board()).replace(/\s+/g, ' ');
  assert.match(text, /Epics .*Features .*User Stories .*Pull requests/);
  assert.match(text, /No Pull request yet/);
});

test('broken chains come first; the link into a broken or empty station is drawn cut', () => {
  const html = board();
  assert.ok(html.indexOf('Driver self-service') < html.indexOf('Maintenance planner'));
  assert.match(html, /class="station cut"/);
});

test('a node touched by a signal is marked, red for high and amber for the rest', () => {
  const html = board();
  assert.match(html, /<div class="node break">[\s\S]*?gh:43[\s\S]*?Agent Pull request, no person reviewed/);
  assert.match(html, /<div class="node warn">[\s\S]*?ado:112[\s\S]*?Done without proof/);
});

test('summary line: chains broken, person reviews, agent share, code with no decision', () => {
  const text = visible(board()).replace(/\s+/g, ' ');
  assert.match(text, /The chain breaks in 2 of 2 Epics\./);
  assert.match(text, /1 of 3 merged Pull requests reviewed by a person/);
  assert.match(text, /50% of commits written by agents/);
  assert.match(text, /1 Pull request with no Epic/);
});

test('an intact team says so', () => {
  const obs = example();
  obs.items = obs.items.filter((i) => ['ado:100', 'ado:110', 'ado:111', 'gh:41'].includes(i.id));
  const gh41 = obs.items.find((i) => i.id === 'gh:41');
  gh41.change.body = 'AB#111';
  gh41.change.reviews[0].body = '[compliance] Met: AC-1 done';
  obs.items.find((i) => i.id === 'ado:100').links = [];
  for (const c of obs.items.find((i) => i.id === 'ado:110').criteria) c.changedAt = '2026-09-05T08:00:00Z';
  const text = visible(board(obs)).replace(/\s+/g, ' ');
  assert.match(text, /Every Epic is\s+intact\s*\./);
});

test('who built it: authorship, where the agent ran, who checked', () => {
  const text = visible(board()).replace(/\s+/g, ' ');
  assert.match(text, /Person \+ Claude Code, local ✓ person and criteria review/);
  assert.match(text, /GitHub Copilot, cloud nobody checked it/);
  assert.match(text, /50% of commits written by agents/);
});

test('the demo team: valid, every chain drawn, every signal shown once', () => {
  const { readJson, readYaml, validateObservations } = require('../lib/validate');
  const obs = readJson(path.join(root, 'examples', 'demo', 'observations.json'));
  const cfg = readYaml(path.join(root, 'examples', 'demo', 'chain.yml'));
  assert.deepEqual(validateObservations(obs), []);
  const result = run(obs, cfg);
  const html = renderBoard(result, obs);
  assert.equal((html.match(/<article class="chain-card/g) || []).length, result.facts.decisions.length + 1);
  assert.equal((html.match(/<li class="signal /g) || []).length, result.signals.length);
  assert.match(visible(html), /Intact/);
});

test('words: plurals and articles', () => {
  assert.equal(plural('User Story', 2), 'User Stories');
  assert.equal(plural('Pull request', 2), 'Pull requests');
  assert.equal(plural('Epic', 1), 'Epic');
  assert.equal(article('Epic'), 'an Epic');
  assert.equal(article('Feature'), 'a Feature');
  assert.equal(esc('<&"\'>'), '&lt;&amp;&quot;&#39;&gt;');
});

test('the same input gives the same page', () => {
  assert.equal(board(), board());
});

test('C5: chain board writes chain/board.html by default', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-'));
  fs.mkdirSync(path.join(dir, 'chain'));
  fs.copyFileSync(path.join(root, 'examples', 'observations.example.json'), path.join(dir, 'chain', 'observations.json'));
  fs.copyFileSync(path.join(root, 'examples', 'chain.example.yml'), path.join(dir, 'chain.yml'));
  const r = spawnSync(process.execPath, [path.join(root, 'bin', 'chain.js'), 'board'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'chain', 'board.html'), 'utf8'), /<span class="team">Fleet Portal<\/span>/);
});

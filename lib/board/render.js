'use strict';
// The board: verdicts and the observations they came from in, one HTML page out.
// Spec D1: a single file that opens from disk, makes no network request and
// runs no script. Styles are inlined; the verdicts are embedded as inert JSON.
// The team's words only: Chain's role names never reach the page (AC-B3).

const fs = require('node:fs');
const path = require('node:path');

const CSS = ['tokens.css', 'board.css'].map((f) => fs.readFileSync(path.join(__dirname, 'css', f), 'utf8')).join('\n');

// Neutral words when chain.yml gives none. None of them is a role name.
const DEFAULT_WORDS = { group: 'Goal', intent: 'Goal', spec: 'Feature', plan: 'Story', change: 'Pull request' };

const SYSTEM_LABELS = {
  'azure-devops': 'Azure DevOps',
  confluence: 'Confluence',
  github: 'GitHub',
  'ado-repos': 'Azure Repos',
  gitlab: 'GitLab',
  'git-files': 'repository files',
  other: 'other source',
};

// The board's four questions (intent, "Proposed outcome"), in order, and the
// rules that answer each. Facts follow as a fifth section.
const SECTIONS = [
  { id: 'gaps', rules: ['done-without-proof', 'stalled-intent', 'change-without-mandate', 'out-of-order'] },
  { id: 'criteria', rules: ['criterion-not-met', 'moved-goalposts', 'declared-divergence'] },
  { id: 'unchecked', rules: ['unverified', 'agent-no-person-review'] },
];

const SEVERITY = {
  'criterion-not-met': 'high',
  'agent-no-person-review': 'high',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plural(word, n) {
  if (n === 1) return word;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

function article(word) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function count(n, word) {
  return `${n} ${plural(word, n)}`;
}

function day(iso) {
  return iso ? String(iso).slice(0, 10) : 'unknown date';
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url || '') ? url : null;
}

function link(url, text) {
  const u = safeUrl(url);
  return u ? `<a href="${esc(u)}">${esc(text)}</a>` : esc(text);
}

function makeWords(vocabulary) {
  const v = { ...DEFAULT_WORDS, ...(vocabulary || {}) };
  if (!vocabulary?.group && vocabulary?.intent) v.group = vocabulary.intent;
  return v;
}

function buildView(result, observations) {
  const words = makeWords(result.vocabulary);
  const byId = new Map(observations.items.map((i) => [i.id, i]));
  const sources = new Map(result.sources.map((s) => [s.id, s]));
  const wordFor = (item) => (item ? item.type || words[item.role] : 'item');
  const sourceLabel = (id) => {
    const s = sources.get(id);
    return s ? SYSTEM_LABELS[s.system] || s.system : id;
  };
  const ruleName = (rule) =>
    ({
      'done-without-proof': 'Done without proof',
      'change-without-mandate': `${words.change} without a mandate`,
      'out-of-order': 'Out of order',
      'moved-goalposts': 'Moved goalposts',
      'stalled-intent': `Stalled ${words.intent}`,
      'criterion-not-met': 'Criterion not met',
      unverified: 'Unverified',
      'declared-divergence': 'Declared divergence',
      'agent-no-person-review': `Agent ${words.change}, no person reviewed`,
    })[rule] || rule;
  return { result, observations, words, byId, sources, wordFor, sourceLabel, ruleName };
}

// One sentence per signal, in the team's words. Plain text; escaped by the caller.
function sentence(view, s) {
  const { byId, wordFor, words } = view;
  const it = (id) => byId.get(id);
  const named = (id) => {
    const i = it(id);
    return i ? `${wordFor(i)} ${id} “${i.title}”` : id;
  };
  const d = s.detail || {};
  switch (s.rule) {
    case 'done-without-proof':
      return `${named(s.items[0])} is done, but no merged ${words.change} links to it.`;
    case 'change-without-mandate':
      return `${named(s.items[0])} was merged with no link to ${article(words.intent)}, ${words.spec} or ${words.plan}.`;
    case 'out-of-order':
      return `${named(s.items[0])} was merged while ${named(s.items[1])} is still ${d.state}.`;
    case 'moved-goalposts':
      return `${named(s.items[0])}: ${d.criterion} changed on ${day(d.changedAt)}, after ${wordFor(it(s.items[1]))} ${s.items[1]} was merged on ${day(d.mergedAt)}.`;
    case 'stalled-intent':
      return d.sinceLastMerge
        ? `${named(s.items[0])} has had no merged ${words.change} for ${d.days} days.`
        : `${named(s.items[0])} has had no merged ${words.change} since it was created, ${d.days} days ago.`;
    case 'criterion-not-met':
      return `${named(s.items[0])}: ${d.severity === 'Block' ? 'blocking: ' : ''}${d.text}`;
    case 'unverified':
      return d.reason === 'unverifiable'
        ? `${named(s.items[0])} was merged, but its review could not check it: ${d.text}`
        : `${named(s.items[0])} was merged with no check against its acceptance criteria.`;
    case 'declared-divergence':
      return `${named(s.items[0])} says it differs from what was agreed: ${d.text}`;
    case 'agent-no-person-review': {
      const who = d.agents && d.agents.length ? d.agents.join(', ') : 'an agent';
      return `${named(s.items[0])} was written ${d.authorship === 'mixed' ? 'partly ' : ''}by ${who} and merged with no review by a person.`;
    }
    default:
      return s.message;
  }
}

function evidenceLinks(view, s) {
  const seen = new Set();
  const links = [];
  for (const e of s.evidence) {
    if (!safeUrl(e.url) || seen.has(e.url)) continue;
    seen.add(e.url);
    const item = view.byId.get(e.item);
    const label = `${e.criterion ? `${e.criterion} on ` : ''}${item ? `${view.wordFor(item)} ${e.item}` : e.item} in ${view.sourceLabel(item?.source)}`;
    links.push(link(e.url, label));
  }
  return links.length ? `<div class="evidence muted">Evidence: ${links.join(' · ')}</div>` : '';
}

function signalCard(view, s) {
  const level = SEVERITY[s.rule] || 'warn';
  const label = level === 'high' ? 'Needs attention' : 'Check';
  return `<li class="signal ${level}">
  <div><span class="pill ${level}">${label}</span> <strong>${esc(view.ruleName(s.rule))}</strong></div>
  <div>${esc(sentence(view, s))}</div>
  ${evidenceLinks(view, s)}
</li>`;
}

function banners(view) {
  const { result } = view;
  const out = [];
  const unread = result.sources.filter((s) => !s.read || s.partial);
  if (unread.length) {
    const lines = unread.map((s) => {
      const what = `${view.sourceLabel(s.id)} (${s.id})`;
      const state = s.read ? 'was only partly read' : 'was not read';
      return `<li>${esc(what)} ${state}${s.reason ? `: ${esc(s.reason)}` : '.'}</li>`;
    });
    out.push(`<div class="notice warn" role="status"><strong>Some sources were not fully read.</strong> What they hold is missing below.<ul>${lines.join('')}</ul></div>`);
  }
  const skipped = result.notChecked.filter((n) => n.skipped);
  const partial = result.notChecked.filter((n) => !n.skipped);
  if (skipped.length || partial.length) {
    const lines = [
      ...skipped.map((n) => `<li><strong>Not checked:</strong> ${esc(view.ruleName(n.rule))}, because ${esc(n.sources.join(', '))} ${n.sources.length === 1 ? 'was' : 'were'} not fully read.</li>`),
      ...partial.map((n) => `<li><strong>Partly checked:</strong> ${esc(view.ruleName(n.rule))} covers only what was read from ${esc(n.sources.join(', '))}.</li>`),
    ];
    out.push(`<div class="notice warn" role="status"><ul>${lines.join('')}</ul></div>`);
  }
  return out.join('\n');
}

function decisionsSection(view) {
  const { result, words, byId, sourceLabel } = view;
  const signalsFor = (d) => {
    const ids = new Set([...d.items, ...d.changes]);
    return result.signals.filter((s) => s.items.some((i) => ids.has(i)));
  };
  const rows = result.facts.decisions.map((d) => {
    // Title the row with the team's group item (an Epic) when there is one.
    const head = d.items.map((id) => byId.get(id)).find((i) => i.role === 'intent' && i.type === words.group) || byId.get(d.id);
    const plans = d.items.map((id) => byId.get(id)).filter((i) => i.role === 'plan');
    const done = plans.filter((i) => i.state === 'done').length;
    const flagged = signalsFor(d);
    const status = flagged.length ? `<span class="pill warn">${esc(count(flagged.length, 'signal'))}</span>` : '<span class="pill ok">No signal</span>';
    const path = d.path.map(sourceLabel).map(esc).join(' → ');
    const share = d.agentSharePercent === null ? '<span class="muted">none yet</span>' : `${d.agentSharePercent}%`;
    return `<tr>
  <td>${link(head.url, head.title)}<div class="mono muted">${esc(head.id)}</div></td>
  <td>${esc(sourceLabel(d.startedIn.source))}<div class="muted">${esc(day(d.startedIn.at))}</div></td>
  <td class="path">${path}</td>
  <td>${plans.length ? `${done} of ${plans.length}` : '<span class="muted">none</span>'}</td>
  <td>${d.changes.length}</td>
  <td>${share}</td>
  <td>${status}</td>
</tr>`;
  });
  return `<section aria-labelledby="s-decisions">
<h2 class="section" id="s-decisions">Where each ${esc(words.group)} stands</h2>
${rows.length ? `<div class="table-wrap"><table>
<thead><tr><th scope="col">${esc(words.group)}</th><th scope="col">Started in</th><th scope="col">Path across tools</th><th scope="col">${esc(plural(words.plan, 2))} done</th><th scope="col">${esc(plural(words.change, 2))} merged</th><th scope="col">Written by agents</th><th scope="col">Status</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>` : '<p class="muted">Nothing found.</p>'}
</section>`;
}

function signalSection(view, id, title, rules) {
  const { result } = view;
  const list = result.signals.filter((s) => rules.includes(s.rule));
  const skipped = result.notChecked.filter((n) => n.skipped && rules.includes(n.rule));
  const body = list.length
    ? `<ul class="signals">\n${list.map((s) => signalCard(view, s)).join('\n')}\n</ul>`
    : `<p class="muted">${skipped.length ? 'Nothing found in what was read. Some checks did not run: see the notes at the top.' : 'Nothing found.'}</p>`;
  return `<section aria-labelledby="s-${id}">
<h2 class="section" id="s-${id}">${esc(title)}</h2>
${body}
</section>`;
}

function writtenBy(c) {
  const agents = c.agents.length ? c.agents.join(', ') : 'an agent';
  const where = c.ranOn === 'cloud' ? ', in the cloud' : c.ranOn === 'local' ? ', on a developer machine' : '';
  if (c.authorship === 'person') return 'A person';
  if (c.authorship === 'agent') return `${agents}${where}`;
  if (c.authorship === 'mixed') return `A person with ${agents}${where}`;
  return 'Unknown';
}

function checkedBy(c) {
  if (c.checkedByPerson && c.checkedByCompliance) return 'A person and the criteria review';
  if (c.checkedByPerson) return 'A person';
  if (c.checkedByCompliance) return 'The criteria review only';
  return '<span class="pill high">Nobody</span>';
}

function builtSection(view) {
  const { result, words, wordFor, byId, sourceLabel } = view;
  const t = result.facts.team;
  const merged = result.facts.changes.filter((c) => c.merged);
  const totals = [
    [String(t.mergedChanges), `${plural(words.change, t.mergedChanges)} merged`],
    [t.agentSharePercent === null ? 'n/a' : `${t.agentSharePercent}%`, 'of commits written by agents'],
    [`${t.byAuthorship.person} / ${t.byAuthorship.mixed} / ${t.byAuthorship.agent}`, 'by a person / mixed / by an agent'],
    [`${t.checkedByPerson} of ${t.mergedChanges}`, 'reviewed by a person'],
    [`${t.checkedByCompliance} of ${t.mergedChanges}`, 'checked against their criteria'],
  ];
  const rows = merged.map((c) => {
    const item = byId.get(c.id);
    const where = `${sourceLabel(c.source)}${c.repository ? `, ${c.repository}` : ''}`;
    return `<tr>
  <td>${link(c.url, c.title)}<div class="mono muted">${esc(wordFor(item))} ${esc(c.id)}</div></td>
  <td>${esc(where)}</td>
  <td>${esc(writtenBy(c))}</td>
  <td>${checkedBy(c)}</td>
</tr>`;
  });
  return `<section aria-labelledby="s-built">
<h2 class="section" id="s-built">Who built it, and who checked it</h2>
<div class="totals">
${totals.map(([v, l]) => `<div class="total"><div class="value">${esc(v)}</div><div class="muted">${esc(l)}</div></div>`).join('\n')}
</div>
${rows.length ? `<div class="table-wrap"><table>
<thead><tr><th scope="col">${esc(words.change)}</th><th scope="col">Where built</th><th scope="col">Written by</th><th scope="col">Checked by</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>` : '<p class="muted">Nothing merged yet.</p>'}
</section>`;
}

// The verdicts, embedded inert for anyone who wants the data behind the page.
function embedded(result) {
  return JSON.stringify(result).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function renderBoard(result, observations) {
  const view = buildView(result, observations);
  const { words } = view;
  const titles = {
    gaps: `${plural(words.group, 2)} with no code, and code with no ${words.group}`,
    criteria: 'Where shipped code misses its acceptance criteria',
    unchecked: 'What shipped without anyone checking it',
  };
  const sections = SECTIONS.map((s) => signalSection(view, s.id, titles[s.id], s.rules));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${esc(result.team)}: Chain board</title>
<style>
${CSS}
</style>
</head>
<body>
<header class="topbar">
  <span class="brand">Chain</span>
  <span class="tagline">Did what we decided get built?</span>
  <span class="updated muted">Collected ${esc(day(result.collectedAt))}, ${esc(String(result.collectedAt).slice(11, 16))} UTC</span>
</header>
<main>
<h1>${esc(result.team)}</h1>
${banners(view)}
${decisionsSection(view)}
${sections.join('\n')}
${builtSection(view)}
</main>
<footer class="muted">Every signal comes from a fixed rule and links to its evidence. Data as of the last collection; run the collector again to refresh.</footer>
<script type="application/json" id="chain-verdicts">${embedded(result)}</script>
</body>
</html>
`;
}

module.exports = { renderBoard, plural, article, esc };

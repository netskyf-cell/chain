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
  const changeFacts = new Map(result.facts.changes.map((c) => [c.id, c]));
  return { result, observations, words, byId, sources, wordFor, sourceLabel, ruleName, changeFacts };
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

const LEVEL = (rule) => SEVERITY[rule] || 'warn';

function signalItem(view, s) {
  const level = LEVEL(s.rule);
  return `<li class="signal ${level}">
  <span class="rule">${esc(view.ruleName(s.rule))}</span>
  <span>${esc(sentence(view, s))}</span>
  ${evidenceLinks(view, s)}
</li>`;
}

function signalList(view, signals, open) {
  if (!signals.length) return '';
  const label = `${count(signals.length, 'signal')}: what broke, with evidence`;
  return `<details class="signals"${open ? ' open' : ''}>
<summary>${esc(label)}</summary>
<ol>
${signals.map((s) => signalItem(view, s)).join('\n')}
</ol>
</details>`;
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
    out.push(`<div class="notice" role="status"><strong>Some sources were not fully read.</strong> What they hold is missing below.<ul>${lines.join('')}</ul></div>`);
  }
  const skipped = result.notChecked.filter((n) => n.skipped);
  const partial = result.notChecked.filter((n) => !n.skipped);
  if (skipped.length || partial.length) {
    const lines = [
      ...skipped.map((n) => `<li><strong>Not checked:</strong> ${esc(view.ruleName(n.rule))}, because ${esc(n.sources.join(', '))} ${n.sources.length === 1 ? 'was' : 'were'} not fully read.</li>`),
      ...partial.map((n) => `<li><strong>Partly checked:</strong> ${esc(view.ruleName(n.rule))} covers only what was read from ${esc(n.sources.join(', '))}.</li>`),
    ];
    out.push(`<div class="notice" role="status"><ul>${lines.join('')}</ul></div>`);
  }
  return out.join('\n');
}

// ---- Chain nodes ------------------------------------------------------------

function whoLabel(c) {
  const agents = c.agents.length ? c.agents.join(', ') : 'an agent';
  const where = c.ranOn === 'cloud' ? ', cloud' : c.ranOn === 'local' ? ', local' : '';
  if (c.authorship === 'person') return 'Person';
  if (c.authorship === 'agent') return `${agents}${where}`;
  if (c.authorship === 'mixed') return `Person + ${agents}${where}`;
  return 'Unknown author';
}

function checkedLabel(c) {
  if (!c.merged) return '<span class="checked">not merged yet</span>';
  if (c.checkedByPerson && c.checkedByCompliance) return '<span class="checked yes">✓ person and criteria review</span>';
  if (c.checkedByPerson) return '<span class="checked yes">✓ reviewed by a person</span>';
  if (c.checkedByCompliance) return '<span class="checked yes">✓ criteria review only</span>';
  return '<span class="checked no">nobody checked it</span>';
}

function marks(view, signals, id) {
  return signals
    .filter((s) => s.items.includes(id))
    .map((s) => `<span class="mark${LEVEL(s.rule) === 'high' ? '' : ' warn'}">${esc(view.ruleName(s.rule))}</span>`)
    .join('');
}

function node(view, item, signals) {
  const hits = signals.filter((s) => s.items.includes(item.id));
  const broken = hits.length ? (hits.some((s) => LEVEL(s.rule) === 'high') ? ' break' : ' warn') : '';
  const source = view.sourceLabel(item.source);
  const type = view.wordFor(item);
  let detail;
  if (item.role === 'change') {
    const c = view.changeFacts.get(item.id);
    detail = `<span class="who ${c.authorship}">${esc(whoLabel(c))}</span>${checkedLabel(c)}`;
  } else {
    const st = item.state === 'done' ? 'done' : item.state === 'open' ? 'open' : '';
    detail = `<span class="state ${st}">${esc(item.sourceState || item.state)}</span>`;
  }
  return `<div class="node${broken}">
  <span class="stamp">${esc(source)} · ${esc(type)}</span>
  ${safeUrl(item.url) ? `<a class="title" href="${esc(item.url)}">${esc(item.title)}</a>` : `<span class="title">${esc(item.title)}</span>`}
  <div class="line"><span class="mono">${esc(item.id)}</span>${detail}</div>
  ${marks(view, signals, item.id)}
</div>`;
}

function station(view, label, items, signals, cut, emptyText) {
  const body = items.length ? items.map((i) => node(view, i, signals)).join('\n') : `<div class="none">${esc(emptyText)}</div>`;
  return `<div class="station${cut ? ' cut' : ''}${items.length ? '' : ' empty'}">
  <span class="stamp station-label">${esc(label)}</span>
  ${body}
</div>`;
}

const touches = (signals, items) => items.some((i) => signals.some((s) => s.items.includes(i.id)));

// ---- Sections ---------------------------------------------------------------

function chainCard(view, group, first) {
  const { words, sourceLabel } = view;
  const { d, items, changes, signals } = group;
  const byRole = (role) => items.filter((i) => i.role === role);
  const columns = [
    [plural(words.intent, 2), byRole('intent'), `No ${words.intent}`],
    [plural(words.spec, 2), byRole('spec'), `No ${words.spec} yet`],
    [plural(words.plan, 2), byRole('plan'), `No ${words.plan} yet`],
    [plural(words.change, 2), changes, `No ${words.change} yet`],
  ];
  const stations = columns.map(([label, list, empty], n) => {
    const next = columns[n + 1];
    const cut = next ? next[1].length === 0 || touches(signals, next[1]) : false;
    return station(view, label, list, signals, cut, empty);
  });
  const head = items.find((i) => i.role === 'intent' && i.type === words.group) || view.byId.get(d.id);
  const route = d.path.map((s) => `<span class="hop">${esc(sourceLabel(s))}</span>`).join(' → ');
  const broken = signals.length > 0;
  const plans = byRole('plan');
  const done = plans.filter((i) => i.state === 'done').length;
  const share = d.agentSharePercent === null ? '' : `<span>${d.agentSharePercent}% of commits by agents</span>`;
  return `<article class="chain-card ${broken ? 'broken' : 'intact'}" aria-label="${esc(head.title)}">
<header class="chain-head">
  <h3>${link(head.url, head.title)}</h3>
  <span class="verdict ${broken ? 'broken' : 'intact'}">${broken ? esc(`${count(signals.length, 'break')}`) : 'Intact'}</span>
  <div class="chain-meta">
    <span>Started in ${esc(sourceLabel(d.startedIn.source))}, ${esc(day(d.startedIn.at))}</span>
    <span class="route">${route}</span>
    ${plans.length ? `<span>${done} of ${count(plans.length, words.plan)} done</span>` : ''}
    ${share}
  </div>
</header>
<div class="chain">
${stations.join('\n')}
</div>
${signalList(view, signals, first)}
</article>`;
}

function orphanCard(view, group) {
  const { words } = view;
  if (!group.changes.length) return '';
  return `<article class="chain-card broken" aria-label="${esc(`Code with no ${words.group}`)}">
<header class="chain-head">
  <h3>${esc(`Code with no ${words.group}`)}</h3>
  <span class="verdict broken">${esc(count(group.changes.length, words.change))}</span>
  <div class="chain-meta"><span>${esc(`Merged with no link to ${article(words.intent)}, ${words.spec} or ${words.plan}.`)}</span></div>
</header>
<div class="chain">
${station(view, plural(words.change, 2), group.changes, group.signals, false, '')}
</div>
${signalList(view, group.signals, false)}
</article>`;
}

function builtSection(view) {
  const { result, words, wordFor, byId, sourceLabel } = view;
  const t = result.facts.team;
  const merged = result.facts.changes.filter((c) => c.merged);
  const total = t.mergedChanges || 1;
  const parts = ['person', 'mixed', 'agent', 'unknown'].filter((k) => t.byAuthorship[k]);
  const labels = { person: 'by a person', mixed: 'person and agent', agent: 'by an agent', unknown: 'unknown author' };
  const bar = parts.map((k) => `<span class="${k}" style="width:${((100 * t.byAuthorship[k]) / total).toFixed(1)}%" title="${t.byAuthorship[k]} ${labels[k]}"></span>`).join('');
  const legend = parts.map((k) => `<span><span class="who ${k}">${t.byAuthorship[k]}</span> ${labels[k]}</span>`).join('');
  const rows = merged.map((c) => {
    const item = byId.get(c.id);
    const where = `${sourceLabel(c.source)}${c.repository ? `, ${c.repository}` : ''}`;
    return `<tr>
  <td>${link(c.url, c.title)}<div class="mono muted">${esc(wordFor(item))} ${esc(c.id)}</div></td>
  <td>${esc(where)}</td>
  <td><span class="who ${c.authorship}">${esc(whoLabel(c))}</span></td>
  <td>${checkedLabel(c)}</td>
</tr>`;
  });
  return `<section aria-labelledby="s-built">
<h2 class="section" id="s-built">Who built it, and who checked it</h2>
<div class="split" role="img" aria-label="${esc(parts.map((k) => `${t.byAuthorship[k]} ${labels[k]}`).join(', '))}">${bar}</div>
<div class="legend">${legend}<span>${t.agentSharePercent === null ? '' : `${t.agentSharePercent}% of commits written by agents`}</span></div>
${rows.length ? `<div class="table-wrap"><table>
<thead><tr><th scope="col">${esc(words.change)}</th><th scope="col">Where built</th><th scope="col">Written by</th><th scope="col">Checked</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table></div>` : '<p class="muted">Nothing merged yet.</p>'}
</section>`;
}

// Decision groups with their items, all linked changes, and the signals that
// touch them; each signal lands in exactly one group, the rest with orphans.
function groupsOf(view) {
  const { result, observations, byId } = view;
  const allChanges = observations.items.filter((i) => i.role === 'change');
  const placed = new Set();
  const groups = result.facts.decisions.map((d) => {
    const ids = new Set(d.items);
    const items = d.items.map((id) => byId.get(id));
    const changes = allChanges.filter((c) => c.links.some((l) => ids.has(l.to))).sort((a, b) => (a.id < b.id ? -1 : 1));
    const all = new Set([...ids, ...changes.map((c) => c.id)]);
    const signals = result.signals.filter((s, n) => !placed.has(n) && s.items.some((i) => all.has(i)) && placed.add(n));
    return { d, items, changes, signals };
  });
  groups.sort((a, b) => b.signals.length - a.signals.length || (a.d.title < b.d.title ? -1 : 1));
  const linked = new Set(groups.flatMap((g) => g.changes.map((c) => c.id)));
  const orphanChanges = allChanges.filter((c) => c.change.merged && !linked.has(c.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const orphan = { changes: orphanChanges, signals: result.signals.filter((s, n) => !placed.has(n)) };
  return { groups, orphan };
}

function thesis(view, groups, orphan) {
  const { result, words } = view;
  const t = result.facts.team;
  const broken = groups.filter((g) => g.signals.length).length;
  const headline = !groups.length
    ? `No ${plural(words.group, 2)} found yet.`
    : broken
      ? `The chain breaks in <span class="count">${broken} of ${groups.length}</span> ${esc(plural(words.group, groups.length))}.`
      : `Every ${esc(words.group)} is <span class="count none">intact</span>.`;
  const facts = [
    [result.signals.length, plural('signal', result.signals.length)],
    [`${t.checkedByPerson} of ${t.mergedChanges}`, `merged ${plural(words.change, t.mergedChanges)} reviewed by a person`],
    [`${t.checkedByCompliance} of ${t.mergedChanges}`, 'checked against their criteria'],
    ...(t.agentSharePercent === null ? [] : [[`${t.agentSharePercent}%`, 'of commits written by agents']]),
    ...(orphan.changes.length ? [[orphan.changes.length, `${plural(words.change, orphan.changes.length)} with no ${words.group}`]] : []),
  ];
  return `<section class="thesis" aria-label="Summary">
<h1>${headline}</h1>
<ul class="facts">${facts.map(([v, l]) => `<li><strong>${esc(String(v))}</strong>${esc(l)}</li>`).join('')}</ul>
</section>`;
}

// The verdicts, embedded inert for anyone who wants the data behind the page.
function embedded(result) {
  return JSON.stringify(result).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function renderBoard(result, observations) {
  const view = buildView(result, observations);
  const { words } = view;
  const { groups, orphan } = groupsOf(view);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${esc(result.team)}: Chain board</title>
<style>
${CSS}
</style>
</head>
<body>
<header class="masthead">
  <span class="brand"><span class="brand-mark">⛓</span> Chain</span>
  <span class="team">${esc(result.team)}</span>
  <span class="collected">Collected ${esc(day(result.collectedAt))}, ${esc(String(result.collectedAt).slice(11, 16))} UTC</span>
</header>
<main>
${banners(view)}
${thesis(view, groups, orphan)}
<section aria-labelledby="s-chains">
<h2 class="section" id="s-chains">${esc(`Each ${words.group}, from decision to code`)}</h2>
${groups.length ? groups.map((g, n) => chainCard(view, g, n === 0 && g.signals.length > 0)).join('\n') : `<p class="muted">${esc(`No ${plural(words.group, 2)} found yet.`)}</p>`}
</section>
${orphan.changes.length ? `<section aria-labelledby="s-orphans">
<h2 class="section" id="s-orphans">${esc(`Code with no ${words.group}`)}</h2>
${orphanCard(view, orphan)}
</section>` : ''}
${builtSection(view)}
</main>
<footer>Every signal comes from a fixed rule and links to its evidence. Data as of the last collection; run the collector again to refresh.</footer>
<script type="application/json" id="chain-verdicts">${embedded(result)}</script>
</body>
</html>
`;
}

module.exports = { renderBoard, plural, article, esc };

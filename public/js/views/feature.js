// Feature chain (F-12, S1a): intent -> spec -> plan with their state
// (accepted, revising, proposed, absent), the open PR if any, lifecycle and health.
// S2 (F-23): the feature's drift signals with severity, rule and evidence.
import { h, notice } from '../dom.js';
import { route } from '../router.js';
import { loadRepo } from '../api.js';
import { artifactBadge, lifecycleBadge, healthBadge, severityBadge, kindLabel, evidenceText, when } from '../labels.js';

const STEPS = [
  ['intent', 'Why'],
  ['spec', 'What'],
  ['plan', 'How'],
];

export async function renderFeature(root, { params }) {
  const { repo, slug } = params;
  const back = h('p', {}, h('a', { href: route('demo', { repo }) }, `← ${repo}`));
  root.replaceChildren(back, notice(`Reading ${repo}…`));

  let data;
  try {
    data = await loadRepo(repo);
  } catch (err) {
    root.replaceChildren(back, notice(err.message, 'error'));
    return;
  }

  const feature = data.model.features.find((f) => f.slug === slug);
  if (!feature) {
    root.replaceChildren(back, notice(`No feature "${slug}" in ${repo}.`, 'error'));
    return;
  }

  const nodes = [];
  STEPS.forEach(([step, question], i) => {
    const a = feature.artifacts[step];
    if (i > 0) nodes.push(h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'));
    nodes.push(h('section', { class: `node ${a.state}`, 'aria-label': `${step}: ${a.state}` },
      h('div', { class: 'step' }, step, ' ', h('span', { class: 'muted' }, `· ${question}`)),
      artifactBadge(a.state),
      h('div', { class: 'mono muted' }, a.path),
      a.pr ? h('div', {}, h('a', { href: a.pr.url }, `PR #${a.pr.number}`), ' open') : null));
  });

  const prs = data.model.prs.filter((p) => feature.prs.includes(p.number));
  const prList = prs.length
    ? h('ul', {}, prs.map((p) => h('li', {},
      h('a', { href: p.url }, `#${p.number}`), ' ', p.title,
      h('span', { class: 'muted' }, ` · ${p.state} · ${p.role}${p.planComplete ? ' · plan complete' : ''}`))))
    : h('p', { class: 'muted' }, 'No linked pull request in the last 30 closed or currently open.');

  const signals = (data.model.signals || []).filter((s) => s.feature === feature.slug);
  const signalList = signals.length
    ? h('ul', { class: 'signals' }, signals.map((s) => h('li', { class: `signal ${s.severity}` },
      h('div', {}, severityBadge(s.severity), ' ', h('strong', {}, kindLabel(s.kind))),
      h('div', {}, s.message),
      h('div', { class: 'muted rule' }, 'Rule: ', s.rule),
      h('div', { class: 'muted' }, 'Evidence: ', h('a', { href: s.evidence.url }, evidenceText(s)), ` · ${when(s.evidence.at)}`))))
    : h('p', { class: 'muted' }, 'No drift signal.');

  // replaceChildren would print a null child as the text "null": drop them first.
  const children = [
    back,
    h('h1', { class: 'mono' }, feature.slug),
    h('p', {},
      feature.capability ? `Capability: ${feature.capability}` : 'No capability declared',
      ' · ', lifecycleBadge(feature.lifecycle),
      ' ', healthBadge(feature.health)),
    h('p', { class: 'muted' }, feature.health.reason),
    h('div', { class: 'chain' }, nodes),
    h('h2', { class: 'section' }, `Signals (${signals.length})`),
    data.historyPartial ? notice('History partial: some reviews or commits were not read, so a signal may be missing.') : null,
    signalList,
    h('h2', { class: 'section' }, 'Linked pull requests'),
    prList,
  ];
  root.replaceChildren(...children.filter(Boolean));
}

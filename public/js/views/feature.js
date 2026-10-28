// Feature chain, static version (F-12 in S0): intent -> spec -> plan,
// each present or absent on the default branch, with its file path.
import { h, notice } from '../dom.js';
import { route } from '../router.js';
import { loadRepo } from '../api.js';

const STEPS = [
  ['intent', 'Why'],
  ['spec', 'What'],
  ['plan', 'How'],
];

function stateBadge(state) {
  // Text and icon, never colour alone (AC-11).
  // S1a: the API now returns accepted / revising / proposed / absent (full view in group C).
  return state === 'absent'
    ? h('span', { class: 'state absent' }, h('span', { 'aria-hidden': 'true' }, '○'), 'absent')
    : h('span', { class: 'state present' }, h('span', { 'aria-hidden': 'true' }, '✓'), state);
}

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
    const artifact = feature.artifacts[step];
    if (i > 0) nodes.push(h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'));
    nodes.push(h('section', { class: `node ${artifact.state}`, 'aria-label': `${step}: ${artifact.state}` },
      h('div', { class: 'step' }, step, ' ', h('span', { class: 'muted' }, `· ${question}`)),
      stateBadge(artifact.state),
      h('div', { class: 'mono muted' }, artifact.path)));
  });

  root.replaceChildren(
    back,
    h('h1', { class: 'mono' }, feature.slug),
    h('p', { class: 'muted' }, feature.capability ? `Capability: ${feature.capability}` : 'No capability declared'),
    h('div', { class: 'chain' }, nodes),
  );
}

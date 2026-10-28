// Capability board, static version (F-10 in S0): one card per capability,
// its statement and its features; an "Unassigned" group when needed.
import { h, notice } from '../dom.js';
import { featureRoute } from '../router.js';

function featureList(repo, slugs) {
  if (!slugs.length) return h('p', { class: 'muted' }, 'No features yet.');
  return h('ul', {}, slugs.map((slug) => h('li', {}, h('a', { href: featureRoute(repo, slug), class: 'mono' }, slug))));
}

export function renderBoard(data) {
  const { repo, sha, truncated, model } = data;
  const out = [
    h('h2', {}, repo, ' ', h('span', { class: 'mono muted' }, `@ ${String(sha).slice(0, 7)}`)),
  ];

  if (truncated) out.push(notice('This repository is large: GitHub returned a truncated file list, so some artifacts may be missing.'));

  if (model.empty) {
    out.push(notice(`No Chain artifacts found. Chain looks for ${model.paths.capabilities}/*.md and ${model.paths.intent}/<slug>/intent.md.`));
    return out;
  }

  const cards = model.capabilities.map((cap) => h('article', { class: 'card' },
    h('h3', {}, cap.statement || h('span', { class: 'muted' }, 'No statement')),
    h('div', { class: 'slug mono' }, cap.slug),
    featureList(repo, cap.features)));

  if (model.unassigned.length) {
    cards.push(h('article', { class: 'card unassigned' },
      h('h3', {}, 'Unassigned'),
      h('div', { class: 'slug' }, 'Features with no capability, or one that does not exist.'),
      featureList(repo, model.unassigned)));
  }

  out.push(h('div', { class: 'board' }, cards));
  return out;
}

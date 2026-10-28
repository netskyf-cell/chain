// Capability board (F-10, S1a): one card per capability with its features,
// each with lifecycle and health as text; a waiting badge linking to the queue;
// the light changes list (F-17); an "Unassigned" group when needed.
import { h, notice } from '../dom.js';
import { featureRoute, route } from '../router.js';
import { lifecycleBadge, healthBadge } from '../labels.js';

function featureRow(repo, feature) {
  return h('li', { class: 'feature-row' },
    h('a', { href: featureRoute(repo, feature.slug), class: 'mono' }, feature.slug),
    ' ', lifecycleBadge(feature.lifecycle),
    ' ', healthBadge(feature.health),
    feature.health.status !== 'on track' ? h('div', { class: 'reason muted' }, feature.health.reason) : null);
}

function featureList(repo, slugs, bySlug) {
  if (!slugs.length) return h('p', { class: 'muted' }, 'No features yet.');
  return h('ul', { class: 'features' }, slugs.map((slug) => featureRow(repo, bySlug.get(slug))));
}

function lightChanges(prs) {
  const light = prs.filter((p) => p.kind === 'light');
  if (!light.length) return null;
  return h('section', { class: 'light' },
    h('h2', {}, `Light changes (${light.length})`),
    h('ul', {}, light.map((p) => h('li', {},
      h('a', { href: p.url }, `#${p.number}`), ' ', p.light,
      h('span', { class: 'muted' },
        ` · ${p.state} · ${p.size.files} file${p.size.files === 1 ? '' : 's'}, +${p.size.additions} −${p.size.deletions}`,
        p.capability ? ` · ${p.capability}` : '')))));
}

export function renderBoard(data) {
  const { repo, sha, truncated, partial, model } = data;
  const bySlug = new Map(model.features.map((f) => [f.slug, f]));
  const waiting = model.queue.length;

  const out = [
    h('div', { class: 'board-head' },
      h('h2', {}, repo, ' ', h('span', { class: 'mono muted' }, `@ ${String(sha).slice(0, 7)}`)),
      h('a', { class: `badge ${waiting ? 'waiting' : 'clear'}`, href: route('waiting', { repo }) },
        h('span', { 'aria-hidden': 'true' }, waiting ? '⏳' : '✓'),
        waiting ? `${waiting} waiting on a human` : 'Nothing waiting')),
  ];

  if (truncated) out.push(notice('This repository is large: GitHub returned a truncated file list, so some artifacts may be missing.'));
  if (partial) out.push(notice('More than 30 pull requests are open: only the 30 most recent were read.'));

  if (model.empty) {
    out.push(notice(`No Chain artifacts found. Chain looks for ${model.paths.capabilities}/*.md and ${model.paths.intent}/<slug>/intent.md.`));
    return out;
  }

  const cards = model.capabilities.map((cap) => h('article', { class: 'card' },
    h('h3', {}, cap.statement || h('span', { class: 'muted' }, 'No statement')),
    h('div', { class: 'slug mono' }, cap.slug),
    featureList(repo, cap.features, bySlug)));

  if (model.unassigned.length) {
    cards.push(h('article', { class: 'card unassigned' },
      h('h3', {}, 'Unassigned'),
      h('div', { class: 'slug' }, 'Features with no capability, or one that does not exist.'),
      featureList(repo, model.unassigned, bySlug)));
  }

  out.push(h('div', { class: 'board' }, cards));
  const light = lightChanges(model.prs);
  if (light) out.push(light);
  return out;
}

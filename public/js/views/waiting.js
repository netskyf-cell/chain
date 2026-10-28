// /#/waiting?repo=owner/name (F-14): every proposed or revising artifact, oldest first.
import { h, notice } from '../dom.js';
import { route, featureRoute } from '../router.js';
import { loadRepo } from '../api.js';
import { artifactBadge, days } from '../labels.js';

export async function renderWaiting(root, { query }) {
  const repo = query.repo;
  if (!repo) {
    root.replaceChildren(h('h1', {}, 'Waiting on a human'), notice('Open a repository first.'), h('p', {}, h('a', { href: route('demo') }, 'Choose a repository')));
    return;
  }

  const back = h('p', {}, h('a', { href: route('demo', { repo }) }, `← ${repo}`));
  root.replaceChildren(back, h('h1', {}, 'Waiting on a human'), notice(`Reading ${repo}…`));

  let data;
  try {
    data = await loadRepo(repo);
  } catch (err) {
    root.replaceChildren(back, h('h1', {}, 'Waiting on a human'), notice(err.message, 'error'));
    return;
  }

  const rows = data.model.queue;
  if (!rows.length) {
    root.replaceChildren(back, h('h1', {}, 'Waiting on a human'), notice('Nothing is waiting: no intent, spec or plan is proposed or being revised.'));
    return;
  }

  const table = h('table', { class: 'queue' },
    h('thead', {}, h('tr', {},
      ['Feature', 'Artifact', 'State', 'Pull request', 'Waiting for', 'Reviewers'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, rows.map((r) => h('tr', {},
      h('td', {}, h('a', { href: featureRoute(repo, r.feature), class: 'mono' }, r.feature)),
      h('td', {}, r.artifact),
      h('td', {}, artifactBadge(r.state)),
      h('td', {}, h('a', { href: r.pr.url }, `#${r.pr.number}`), ' ', h('span', { class: 'muted' }, r.pr.title)),
      h('td', {}, days(r.ageDays)),
      h('td', {}, r.reviewers.length ? r.reviewers.join(', ') : h('span', { class: 'muted' }, 'none requested'))))));

  root.replaceChildren(back, h('h1', {}, `Waiting on a human (${rows.length})`),
    h('p', { class: 'muted' }, 'Oldest first. Each row is a decision: accept by merging the pull request.'),
    h('div', { class: 'table-wrap' }, table));
}

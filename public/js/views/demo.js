// /#/demo and /#/demo?repo=owner/name (F-04): paste a public repository, see its board.
import { h, notice } from '../dom.js';
import { route } from '../router.js';
import { loadRepo } from '../api.js';
import { renderBoard } from './board.js';
import { startPolling } from '../poll.js';

// One poller at a time: stop it when the route or the repository changes.
let stopPolling = null;
window.addEventListener('hashchange', () => {
  if (stopPolling) stopPolling();
  stopPolling = null;
});

// Accepts "owner/name" or a github.com URL; returns "owner/name" or null.
export function normaliseRepo(input) {
  let value = String(input || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const url = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i);
  if (url) value = url[1];
  const parts = value.split('/');
  return parts.length === 2 && parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : null;
}

export async function renderDemo(root, { query }) {
  const current = query.repo || '';
  const input = h('input', {
    id: 'repo-input',
    name: 'repo',
    value: current,
    placeholder: 'owner/name or https://github.com/owner/name',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const error = h('div');

  const form = h('form', {
    class: 'repo-form',
    onsubmit: (event) => {
      event.preventDefault();
      const repo = normaliseRepo(input.value);
      if (!repo) {
        error.replaceChildren(notice('Enter a repository as owner/name or paste its GitHub URL.', 'error'));
        return;
      }
      window.location.hash = route('demo', { repo }).slice(1);
    },
  },
  h('label', { for: 'repo-input' }, 'Public GitHub repository'),
  input,
  h('button', { type: 'submit' }, 'Show the chain'));

  root.replaceChildren(h('h1', {}, 'See a repository’s chain'), form, error);

  if (!current) {
    root.append(h('p', { class: 'muted' }, 'Try ', h('a', { href: route('demo', { repo: 'netskyf-cell/chain' }) }, 'netskyf-cell/chain'), ', Chain’s own repository.'));
    return;
  }

  const result = h('section', { 'aria-busy': 'true' }, notice(`Reading ${current}…`));
  root.append(result);
  try {
    const data = await loadRepo(current);
    result.replaceChildren(...renderBoard(data));
    // Installed repositories stay fresh without reloading (S1b, AC-11).
    if (data.source === 'state') {
      if (stopPolling) stopPolling();
      stopPolling = startPolling({
        load: () => loadRepo(current),
        onData: (next) => result.replaceChildren(...renderBoard(next)),
      });
    }
  } catch (err) {
    result.replaceChildren(notice(err.message, 'error'));
  } finally {
    result.removeAttribute('aria-busy');
  }
}

// Hash router. Every internal link is /#/route (CLAUDE.md, refresh-safe on static hosting).
// Pure functions only: no DOM access at import, so tests can load this file in Node.

// Builds an internal link. Always use this instead of writing hrefs by hand.
export function route(path, params) {
  const clean = String(path).replace(/^\/?#?\/?/, '');
  const query = params ? new URLSearchParams(params).toString() : '';
  return `/#/${clean}${query ? `?${query}` : ''}`;
}

export function featureRoute(repo, slug) {
  return route(`feature/${encodeURIComponent(repo)}/${encodeURIComponent(slug)}`);
}

// '#/feature/owner%2Fname/slug?x=1' -> { name: 'feature', params: { repo, slug }, query }
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const [path, queryString = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString));
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'demo' && parts.length === 1) return { name: 'demo', params: {}, query };
  if (parts[0] === 'waiting' && parts.length === 1) return { name: 'waiting', params: {}, query };
  if (parts[0] === 'feature' && parts.length === 3) {
    try {
      return {
        name: 'feature',
        params: { repo: decodeURIComponent(parts[1]), slug: decodeURIComponent(parts[2]) },
        query,
      };
    } catch {
      return { name: 'not-found', params: {}, query };
    }
  }
  return { name: 'not-found', params: {}, query };
}

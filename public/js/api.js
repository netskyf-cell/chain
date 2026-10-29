// The only place the front end talks to the server. It never calls GitHub directly
// and never holds a token: /api/state and /api/demo do that server side.
//
// S1b: a repository with the Chain App installed is read from /api/state (Chain's
// database, kept fresh by webhooks). Anything else (not installed, private, or the
// database not configured) falls back to /api/demo, which reads public repositories.

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

function fail(res, body) {
  const message = (body && body.error) || `Something went wrong (${res.status}). Try again later.`;
  return new Error(message);
}

export async function loadRepo(repo, fetchImpl = (...args) => globalThis.fetch(...args)) {
  const q = encodeURIComponent(repo);
  const state = await getJson(fetchImpl, `/api/state?repo=${q}`);
  if (state.res.ok) return { ...state.body, source: 'state' };
  if (state.res.status !== 404 && state.res.status !== 503) throw fail(state.res, state.body);

  const demo = await getJson(fetchImpl, `/api/demo?repo=${q}`);
  if (!demo.res.ok) throw fail(demo.res, demo.body);
  return { ...demo.body, source: 'demo' };
}

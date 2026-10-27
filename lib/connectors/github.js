'use strict';
// GitHub connector for S0: read-only access to one repository's default branch.
//
// Two REST calls per scan:
//   1. GET /repos/:owner/:name/commits/HEAD   -> commit SHA and tree SHA
//   2. GET /repos/:owner/:name/git/trees/:tree?recursive=1 -> file list
// File contents come from raw.githubusercontent.com at that commit SHA,
// which does not count against the REST rate limit.
//
// It observes only: no rules, no writes (ADR-0004, ADR-0005).
// `fetch` is passed in so tests can replay recorded responses.

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

class GitHubError extends Error {
  // code: 'not_found' | 'rate_limited' | 'upstream'
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function headersFor(token, accept) {
  const headers = { Accept: accept, 'User-Agent': 'chain-demo', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function check(res) {
  if (res.ok) return res;
  if (res.status === 404) throw new GitHubError('not_found', 'Repository not found');
  const remaining = res.headers && res.headers.get('x-ratelimit-remaining');
  if (res.status === 429 || (res.status === 403 && remaining === '0')) {
    throw new GitHubError('rate_limited', 'GitHub rate limit reached');
  }
  throw new GitHubError('upstream', `GitHub returned ${res.status}`);
}

async function readRepo({ owner, name }, { fetch, token } = {}) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const json = (url) => fetch(url, { headers: headersFor(token, 'application/vnd.github+json') })
    .then(check)
    .then((r) => r.json());

  const commit = await json(`${base}/commits/HEAD`);
  const sha = commit.sha;
  const tree = await json(`${base}/git/trees/${commit.commit.tree.sha}?recursive=1`);

  const files = tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path).sort();

  async function read(path) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const url = `${RAW}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${sha}/${encoded}`;
    const res = await fetch(url, { headers: headersFor(token, 'text/plain') }).then(check);
    return res.text();
  }

  return { sha, files, truncated: Boolean(tree.truncated), read };
}

module.exports = { readRepo, GitHubError };

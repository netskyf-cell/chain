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

// ---- Pull requests (S1a) ----------------------------------------------------
//
// Reads per scan: 1 list of open PRs, 1 list of recently closed PRs, then files
// (and reviews, for open PRs) per PR. At most 30 of each list (spec S1a).
// Returns facts only; every rule lives in lib/reconcile/state.js.

const PR_LIMIT = 30;

function hasNextPage(res) {
  const link = res.headers && res.headers.get('link');
  return typeof link === 'string' && /rel="next"/.test(link);
}

function toFacts(pr, files, reviews) {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user ? pr.user.login : null,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at || null,
    draft: Boolean(pr.draft),
    body: pr.body || '',
    labels: (pr.labels || []).map((l) => l.name),
    requestedReviewers: [
      ...(pr.requested_reviewers || []).map((u) => u.login),
      ...(pr.requested_teams || []).map((t) => `team:${t.slug}`),
    ],
    files: files.map((f) => ({
      path: f.filename,
      status: f.status,
      additions: f.additions || 0,
      deletions: f.deletions || 0,
      previousPath: f.previous_filename || null,
    })),
    reviews: reviews.map((r) => ({ user: r.user ? r.user.login : null, state: r.state, submittedAt: r.submitted_at })),
  };
}

async function readPullRequests({ owner, name }, { fetch, token } = {}) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const get = (url) => fetch(url, { headers: headersFor(token, 'application/vnd.github+json') }).then(check);

  const openRes = await get(`${base}/pulls?state=open&per_page=${PR_LIMIT}`);
  const openList = await openRes.json();
  const closedList = await (await get(`${base}/pulls?state=closed&per_page=${PR_LIMIT}&sort=updated&direction=desc`)).json();
  const mergedList = closedList.filter((pr) => pr.merged_at);

  const filesOf = (n) => get(`${base}/pulls/${n}/files?per_page=100`).then((r) => r.json());
  const reviewsOf = (n) => get(`${base}/pulls/${n}/reviews?per_page=100`).then((r) => r.json());

  const open = await Promise.all(openList.map(async (pr) => toFacts(pr, await filesOf(pr.number), await reviewsOf(pr.number))));
  const merged = await Promise.all(mergedList.map(async (pr) => toFacts(pr, await filesOf(pr.number), [])));

  return { open, merged, partial: hasNextPage(openRes) };
}

module.exports = { readRepo, readPullRequests, GitHubError };

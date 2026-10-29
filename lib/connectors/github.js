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
// Reads per scan: 1 list of open PRs, 1 list of recently closed PRs, then files,
// reviews and inline comments per PR. At most 30 of each list (spec S1a).
// S2 caps: reviews of merged PRs 30, inline comments 60 (spec S2).
// Returns facts only; every rule lives in lib/reconcile/.

const PR_LIMIT = 30;
const CAPS = Object.freeze({ mergedReviews: 30, comments: 60, history: 30, commitPulls: 30, completions: 10 });

function hasNextPage(res) {
  const link = res.headers && res.headers.get('link');
  return typeof link === 'string' && /rel="next"/.test(link);
}

function toFacts(pr, files, reviews, comments, checks = null) {
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
    mergeCommitSha: pr.merge_commit_sha || null,
    headSha: (pr.head && pr.head.sha) || null,
    // S1b: check runs and commit statuses on the head commit (open PRs only; null when not read).
    checks,
    reviews: reviews.map((r) => ({
      user: r.user ? r.user.login : null,
      state: r.state,
      submittedAt: r.submitted_at,
      body: r.body || '',
      url: r.html_url || null,
    })),
    // Inline review comments (S2). Issue-style comments are not read (spec S2, decision 1).
    comments: comments.map((c) => ({
      user: c.user ? c.user.login : null,
      body: c.body || '',
      createdAt: c.created_at,
      url: c.html_url || null,
    })),
  };
}

// Runs `fn` for at most `cap` items; the rest get `fallback`. Says whether it skipped.
function capped(cap) {
  let used = 0;
  let over = false;
  return {
    async run(fn, fallback) {
      if (used >= cap) {
        over = true;
        return fallback;
      }
      used += 1;
      return fn();
    },
    get over() {
      return over;
    },
  };
}

async function readPullRequests({ owner, name }, { fetch, token, readChecks = false } = {}) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const get = (url) => fetch(url, { headers: headersFor(token, 'application/vnd.github+json') }).then(check);

  const openRes = await get(`${base}/pulls?state=open&per_page=${PR_LIMIT}`);
  const openList = await openRes.json();
  const closedList = await (await get(`${base}/pulls?state=closed&per_page=${PR_LIMIT}&sort=updated&direction=desc`)).json();
  const mergedList = closedList.filter((pr) => pr.merged_at);

  const filesOf = (n) => get(`${base}/pulls/${n}/files?per_page=100`).then((r) => r.json());
  const reviewsOf = (n) => get(`${base}/pulls/${n}/reviews?per_page=100`).then((r) => r.json());

  const commentsOf = (n) => get(`${base}/pulls/${n}/comments?per_page=100`).then((r) => r.json());
  // S1b: checks of an open PR's head commit (Checks: read, Commit statuses: read; ADR-0004).
  // A 403 or 404 (permission not granted, e.g. the demo token) means "not read": null.
  async function checksOf(sha) {
    if (!sha) return null;
    const read = async (url) => {
      const res = await fetch(url, { headers: headersFor(token, 'application/vnd.github+json') });
      if (res.status === 403 || res.status === 404) return null;
      return (await check(res)).json();
    };
    const runs = await read(`${base}/commits/${sha}/check-runs?per_page=100`);
    const status = await read(`${base}/commits/${sha}/status`);
    if (!runs && !status) return null;
    return {
      runs: ((runs && runs.check_runs) || []).map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion })),
      statuses: ((status && status.statuses) || []).map((x) => ({ context: x.context, state: x.state })),
    };
  }
  const mergedReviews = capped(CAPS.mergedReviews);
  const comments = capped(CAPS.comments);

  // Sequential per list so the caps apply in a stable order (newest lists first).
  const open = [];
  for (const pr of openList) {
    open.push(toFacts(pr, await filesOf(pr.number), await reviewsOf(pr.number),
      await comments.run(() => commentsOf(pr.number), []),
      readChecks ? await checksOf(pr.head && pr.head.sha) : null));
  }
  const merged = [];
  for (const pr of mergedList) {
    merged.push(toFacts(pr, await filesOf(pr.number),
      await mergedReviews.run(() => reviewsOf(pr.number), []),
      await comments.run(() => commentsOf(pr.number), [])));
  }

  return { open, merged, partial: hasNextPage(openRes), findingsPartial: mergedReviews.over || comments.over };
}

// ---- Artifact history (S2) ----------------------------------------------------
//
// For each path: GET commits?path=&since= (cap 30 paths), then for each commit
// GET commits/:sha/pulls (cap 30 commits, deduplicated across paths).
// A path not read has no entry. A commit whose PRs were not read has no `prs`
// (unknown, never "no PR"). `partial` says some history was skipped.

async function readHistory({ owner, name }, { paths, since }, { fetch, token } = {}) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const get = (url) => fetch(url, { headers: headersFor(token, 'application/vnd.github+json') }).then(check);
  const pathCap = capped(CAPS.history);
  const pullsCap = capped(CAPS.commitPulls);
  const prsBySha = new Map();
  const history = {};

  for (const path of [...new Set(paths)].sort()) {
    const query = new URLSearchParams({ path, per_page: '100' });
    if (since) query.set('since', since);
    const res = await pathCap.run(() => get(`${base}/commits?${query}`), null);
    if (!res) continue;
    const list = await res.json();
    const commits = [];
    for (const c of list) {
      if (!prsBySha.has(c.sha)) {
        const pulls = await pullsCap.run(() => get(`${base}/commits/${c.sha}/pulls`).then((r) => r.json()), undefined);
        prsBySha.set(c.sha, pulls && pulls.map((p) => p.number).sort((a, b) => a - b));
      }
      const prs = prsBySha.get(c.sha);
      commits.push({ sha: c.sha, date: c.commit.committer.date, url: c.html_url, ...(prs ? { prs } : {}) });
    }
    history[path] = { partial: hasNextPage(res), commits };
  }

  const partial = pathCap.over || pullsCap.over || Object.values(history).some((h) => h.partial);
  return { history, partial };
}

// ---- Older completions (S1 spec, revised 2026-10-29) --------------------------
//
// The 30-PR window forgets features shipped long ago (found live: S0 read "planned").
// One search finds merged PRs whose body mentions "Plan complete: yes", whatever their
// age; files are read for those outside the window (cap 10). Candidates only: whether a
// PR really declares completion, and for which feature, is decided in reconcile.
// A failed search (403, 422, rate limit) means "not read": [] and partial.
// Cached like any GET; a completion merged in the last day is in the window anyway.

async function readCompletions({ owner, name }, { exclude = [] } = {}, { fetch, token } = {}) {
  const q = `repo:${owner}/${name} is:pr is:merged "Plan complete: yes"`;
  const query = new URLSearchParams({ q, sort: 'created', order: 'desc', per_page: '30' });
  const res = await fetch(`${API}/search/issues?${query}`, { headers: headersFor(token, 'application/vnd.github+json') });
  if (!res.ok) return { prs: [], partial: true };
  const items = ((await res.json()).items || [])
    .filter((it) => it.pull_request && it.pull_request.merged_at && !exclude.includes(it.number))
    .sort((a, b) => b.number - a.number);
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const cap = capped(CAPS.completions);
  const prs = [];
  for (const it of items) {
    const files = await cap.run(() => fetch(`${base}/pulls/${it.number}/files?per_page=100`, {
      headers: headersFor(token, 'application/vnd.github+json'),
    }).then(check).then((r) => r.json()), null);
    if (!files) continue;
    prs.push(toFacts({ ...it, merged_at: it.pull_request.merged_at }, files, [], []));
  }
  return { prs, partial: cap.over };
}

module.exports = { readRepo, readPullRequests, readHistory, readCompletions, GitHubError, CAPS };

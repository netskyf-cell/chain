'use strict';
// Which cached GitHub responses a webhook event makes stale (S1b spec, "Refresh
// without re-reading everything"). Returns URL prefixes for store.markChanged().
// Observation plumbing only: no rule about features, PRs or drift lives here.

const API = 'https://api.github.com';

function changedPrefixes(event, payload, repoRow) {
  const base = `${API}/repos/${encodeURIComponent(repoRow.gh_owner)}/${encodeURIComponent(repoRow.gh_name)}`;
  const lists = [`${base}/pulls?state=`];
  const prNumber = payload.pull_request && payload.pull_request.number;
  switch (event) {
    case 'pull_request':
      return [...lists, `${base}/pulls/${prNumber}/`];
    case 'pull_request_review':
      return [...lists, `${base}/pulls/${prNumber}/reviews`];
    case 'pull_request_review_comment':
      return [`${base}/pulls/${prNumber}/comments`];
    case 'push': {
      const branch = repoRow.default_branch || (payload.repository && payload.repository.default_branch) || 'main';
      if (payload.ref !== `refs/heads/${branch}`) return []; // only the default branch is scanned
      // New commit: HEAD, then (new SHAs give new tree and raw URLs) artifact histories.
      return [`${base}/commits/HEAD`, `${base}/commits?`];
    }
    case 'check_run':
    case 'check_suite': {
      const item = payload.check_run || payload.check_suite || {};
      return item.head_sha ? [`${base}/commits/${item.head_sha}/check-runs`] : [];
    }
    case 'status':
      return payload.sha ? [`${base}/commits/${payload.sha}/status`] : [];
    default:
      return [];
  }
}

module.exports = { changedPrefixes };

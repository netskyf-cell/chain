'use strict';
// A fake fetch that replays fixtures/github/ and counts calls.
// Lets tests check the connector and the endpoint without any network.
//
// options.open:   replace the recorded (empty) open PR list with synthetic PRs,
//                 in GitHub's raw shape; options.files / options.reviews give
//                 their files and reviews by PR number.
// options.next:   add a Link header with rel="next" to the open PR list.
// options.closed: replace the recorded closed PR list.
// options.comments / history / commitPulls: override recorded S2 responses
//                 (by PR number, artifact path and commit SHA).
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'fixtures', 'github');
const read = (p) => JSON.parse(fs.readFileSync(path.join(DIR, p), 'utf8'));
const commit = read('commit.json');
const tree = read('tree.json');
const SHA = commit.sha;
const recordedOpen = read('pulls/open.json');
const recordedClosed = read('pulls/closed.json');

function response(status, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

// A recorded file, or `fallback` when none was recorded.
function recorded(rel, fallback) {
  const f = path.join(DIR, rel);
  return fs.existsSync(f) ? response(200, fs.readFileSync(f, 'utf8')) : response(200, fallback);
}

// mode: 'ok' | 'not-found' | 'rate-limited' | 'server-error'
function fakeFetch(mode = 'ok', options = {}) {
  const calls = [];
  const open = options.open || recordedOpen;

  async function fetch(url, opts = {}) {
    calls.push({ url, headers: opts.headers || {} });
    if (mode === 'not-found') return response(404, { message: 'Not Found' });
    if (mode === 'rate-limited') {
      return response(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });
    }
    if (mode === 'server-error') return response(500, { message: 'boom' });

    const u = new URL(url);
    if (u.hostname === 'api.github.com') {
      const p = u.pathname.replace('/repos/netskyf-cell/chain', '');
      if (p === '/commits/HEAD') return response(200, commit);
      if (p === `/git/trees/${commit.commit.tree.sha}`) return response(200, tree);
      if (p === '/pulls' && u.searchParams.get('state') === 'open') {
        const headers = options.next ? { link: '<https://api.github.com/x?page=2>; rel="next"' } : {};
        return response(200, open, headers);
      }
      if (p === '/pulls' && u.searchParams.get('state') === 'closed') return response(200, options.closed || recordedClosed);
      const files = p.match(/^\/pulls\/(\d+)\/files$/);
      if (files) {
        const n = Number(files[1]);
        if (options.files && options.files[n]) return response(200, options.files[n]);
        const f = path.join(DIR, 'pulls', 'files', `${n}.json`);
        return fs.existsSync(f) ? response(200, fs.readFileSync(f, 'utf8')) : response(200, []);
      }
      const reviews = p.match(/^\/pulls\/(\d+)\/reviews$/);
      if (reviews) {
        const n = Number(reviews[1]);
        if (options.reviews && options.reviews[n]) return response(200, options.reviews[n]);
        return recorded(path.join('pulls', 'reviews', `${n}.json`), []);
      }
      const comments = p.match(/^\/pulls\/(\d+)\/comments$/);
      if (comments) {
        const n = Number(comments[1]);
        if (options.comments && options.comments[n]) return response(200, options.comments[n]);
        return recorded(path.join('pulls', 'comments', `${n}.json`), []);
      }
      if (p === '/commits' && u.searchParams.get('path')) {
        const name = u.searchParams.get('path').replace(/\//g, '__');
        if (options.history && options.history[u.searchParams.get('path')]) return response(200, options.history[u.searchParams.get('path')]);
        return recorded(path.join('history', `${name}.json`), []);
      }
      const pulls = p.match(/^\/commits\/([0-9a-z]+)\/pulls$/);
      if (pulls) {
        if (options.commitPulls && options.commitPulls[pulls[1]]) return response(200, options.commitPulls[pulls[1]]);
        return recorded(path.join('commit-pulls', `${pulls[1]}.json`), []);
      }
    }
    if (u.hostname === 'raw.githubusercontent.com') {
      const prefix = `/netskyf-cell/chain/${SHA}/`;
      if (u.pathname.startsWith(prefix)) {
        const file = path.join(DIR, 'raw', decodeURIComponent(u.pathname.slice(prefix.length)));
        if (fs.existsSync(file)) return response(200, fs.readFileSync(file, 'utf8'));
      }
    }
    return response(404, { message: 'Not Found' });
  }
  fetch.calls = calls;
  fetch.restCalls = () => calls.filter((c) => new URL(c.url).hostname === 'api.github.com').length;
  return fetch;
}

// A synthetic open PR in GitHub's raw shape.
function rawPr(number, extra = {}) {
  return {
    number,
    title: `PR ${number}`,
    html_url: `https://github.com/netskyf-cell/chain/pull/${number}`,
    user: { login: 'dev' },
    created_at: '2026-10-27T10:00:00Z',
    updated_at: '2026-10-27T10:00:00Z',
    merged_at: null,
    draft: false,
    body: '',
    labels: [],
    requested_reviewers: [],
    requested_teams: [],
    ...extra,
  };
}

module.exports = { fakeFetch, rawPr, SHA, recordedClosed };

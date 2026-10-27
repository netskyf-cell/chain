'use strict';
// A fake fetch that replays fixtures/github/ and counts calls.
// Lets tests check the connector and the endpoint without any network.
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'fixtures', 'github');
const commit = JSON.parse(fs.readFileSync(path.join(DIR, 'commit.json'), 'utf8'));
const tree = JSON.parse(fs.readFileSync(path.join(DIR, 'tree.json'), 'utf8'));
const SHA = commit.sha;

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

// mode: 'ok' | 'not-found' | 'rate-limited' | 'server-error'
function fakeFetch(mode = 'ok') {
  const calls = [];
  async function fetch(url, options = {}) {
    calls.push({ url, headers: options.headers || {} });
    if (mode === 'not-found') return response(404, { message: 'Not Found' });
    if (mode === 'rate-limited') {
      return response(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });
    }
    if (mode === 'server-error') return response(500, { message: 'boom' });

    const u = new URL(url);
    if (u.hostname === 'api.github.com') {
      if (u.pathname === '/repos/netskyf-cell/chain/commits/HEAD') return response(200, commit);
      if (u.pathname === `/repos/netskyf-cell/chain/git/trees/${commit.commit.tree.sha}`) return response(200, tree);
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

module.exports = { fakeFetch, SHA };

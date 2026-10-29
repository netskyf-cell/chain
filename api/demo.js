'use strict';
// GET /api/demo?repo=owner/name
// Demo mode (F-04): reads a public repository and returns Chain's model:
// S0 scan of the default branch, S1a state from pull requests, and S2 drift
// signals from reviews and artifact history (reconcile).
//
// The read-only GITHUB_DEMO_TOKEN lives only here, server side. It is optional in
// local development (GitHub then allows 60 unauthenticated calls per hour) and
// required on Vercel. It never appears in a response or a log line.
//
// Works as a Vercel function and under dev-server.js: it only uses
// req.method, req.url, req.headers, res.statusCode, res.setHeader and res.end.

const { collect, derive, historyPartial } = require('../lib/sync');
const { createCache } = require('../lib/cache');
const { createRateLimit } = require('../lib/rate-limit');

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Accepts "owner/name" or a github.com URL. Returns { owner, name } or null.
function parseRepo(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const url = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i);
  if (url) value = url[1];
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!OWNER.test(owner) || !NAME.test(name) || name === '.' || name === '..') return null;
  return { owner, name };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clientId(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

const ERRORS = {
  not_found: [404, 'Repository not found or not public. Check the owner and name.'],
  rate_limited: [503, 'GitHub is limiting requests right now. Try again later.'],
  upstream: [502, 'GitHub could not be read. Try again later.'],
};

function createDemoHandler({ fetch, token, now }) {
  const cache = createCache({ ttlMs: CACHE_TTL_MS, now });
  const allow = createRateLimit({ limit: 30, windowMs: 60 * 1000, now });

  return async function handler(req, res) {
    if (req.method !== 'GET') return send(res, 405, { error: 'Only GET is allowed.' });
    if (!allow(clientId(req))) return send(res, 429, { error: 'Too many requests. Wait a minute and try again.' });

    const query = new URL(req.url, 'http://localhost').searchParams;
    const repo = parseRepo(query.get('repo'));
    if (!repo) return send(res, 400, { error: 'Give a repository as owner/name or a github.com URL.' });

    const key = `${repo.owner}/${repo.name}`.toLowerCase();
    const cached = cache.get(key);
    if (cached) return send(res, 200, cached);

    try {
      const facts = await collect(repo, { fetch, token });
      // reconcile() is pure: the current time is passed in, never read inside.
      const model = derive(facts, new Date(now()).toISOString());
      const body = {
        repo: `${repo.owner}/${repo.name}`,
        sha: facts.sha,
        truncated: facts.truncated,
        partial: facts.prs.partial,
        historyPartial: historyPartial(facts),
        model,
      };
      cache.set(key, body);
      return send(res, 200, body);
    } catch (err) {
      const [status, message] = ERRORS[err.code] || ERRORS.upstream;
      // Log the error kind only: never the token, never repository content.
      console.error(`api/demo: ${err.code || 'error'} for ${key}`);
      return send(res, status, { error: message });
    }
  };
}

const handler = createDemoHandler({
  fetch: (...args) => globalThis.fetch(...args),
  token: process.env.GITHUB_DEMO_TOKEN || '',
  now: () => Date.now(),
});

module.exports = handler;
module.exports.createDemoHandler = createDemoHandler;
module.exports.parseRepo = parseRepo;

'use strict';
// GET /api/state?repo=owner/name (S1b). The board's data for an installed repository,
// from Chain's database instead of a full GitHub read.
//
// - Serves only repositories that are installed AND public on GitHub. Private ones are
//   stored but not served until sign-in exists (S3); they get the same 404 as an
//   unknown repository, so the answer does not reveal that they exist.
// - Data older than 5 minutes (or never read) is refreshed first, through the ETag cache:
//   unchanged GitHub resources cost nothing (ADR-0014, F-05 fallback).
// - Otherwise the stored facts are reconciled with the current time (health depends on it).
const { send, clientId } = require('../lib/http');
const { parseRepo } = require('./demo');
const { createRateLimit } = require('../lib/rate-limit');
const { createHttpCache } = require('../lib/store/http-cache');
const { refresh: defaultRefresh, derive, historyPartial } = require('../lib/sync');

const STALE_MS = 5 * 60 * 1000;
const NOT_FOUND = [404, { error: 'This repository is not connected to Chain.' }];
const ERRORS = {
  not_found: [404, { error: 'Repository not found.' }],
  rate_limited: [503, { error: 'GitHub is limiting requests right now. Try again later.' }],
  app_auth: [503, { error: 'Chain could not authenticate with GitHub. Try again later.' }],
  store: [503, { error: 'Chain could not read its database. Try again later.' }],
};

function createStateHandler({ store, appAuth, fetch, now, refresh = defaultRefresh }) {
  const allow = createRateLimit({ limit: 30, windowMs: 60 * 1000, now });

  return async function handler(req, res) {
    if (req.method !== 'GET') return send(res, 405, { error: 'Only GET is allowed.' });
    if (!store) return send(res, 503, { error: 'Chain\'s database is not configured.' });
    if (!allow(clientId(req))) return send(res, 429, { error: 'Too many requests. Wait a minute and try again.' });

    const repo = parseRepo(new URL(req.url, 'http://localhost').searchParams.get('repo'));
    if (!repo) return send(res, 400, { error: 'Give a repository as owner/name or a github.com URL.' });

    try {
      const row = await store.getRepoByName(repo.owner, repo.name);
      if (!row || !row.is_public || !row.installation_id) return send(res, ...NOT_FOUND);

      const nowMs = now();
      const nowIso = new Date(nowMs).toISOString();
      const snapshot = await store.latestSnapshot(row.id);
      const stale = !snapshot || !row.refreshed_at || nowMs - Date.parse(row.refreshed_at) > STALE_MS;

      let facts;
      let model;
      let refreshedAt;
      if (stale) {
        const token = await appAuth.installationToken(row.installation_id);
        const cached = createHttpCache({ store, fetch, now });
        ({ facts, model, refreshedAt } = await refresh({ repoRow: row, fetch: cached, token, store, now }));
      } else {
        facts = snapshot.payload;
        model = derive(facts, nowIso);
        refreshedAt = row.refreshed_at;
      }

      return send(res, 200, {
        repo: `${row.gh_owner}/${row.gh_name}`,
        sha: facts.sha,
        truncated: facts.truncated,
        partial: facts.prs.partial,
        historyPartial: historyPartial(facts),
        installed: true,
        refreshedAt,
        model,
      });
    } catch (err) {
      const [status, body] = ERRORS[err.code] || [502, { error: 'Chain could not read this repository. Try again later.' }];
      // App-auth and store messages are written to carry no secret (lib/github-app.js, lib/store/supabase.js).
      console.error(`api/state: ${err.code || 'error'}${['app_auth', 'store'].includes(err.code) ? ` (${err.message})` : ''}`);
      return send(res, status, body);
    }
  };
}

function fromEnv() {
  const env = process.env;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return createStateHandler({ store: null, now: () => Date.now() });
  }
  const { createSupabaseStore } = require('../lib/store/supabase');
  const { createAppAuth } = require('../lib/github-app');
  const fetch = (...args) => globalThis.fetch(...args);
  const now = () => Date.now();
  return createStateHandler({
    store: createSupabaseStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, fetch }),
    appAuth: createAppAuth({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY, fetch, now }),
    fetch,
    now,
  });
}

const handler = fromEnv();
module.exports = handler;
module.exports.createStateHandler = createStateHandler;

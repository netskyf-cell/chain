'use strict';
// POST /api/webhooks/github (S1b, F-05). GitHub calls this when something changes.
//
// 1. Verify X-Hub-Signature-256 on the raw body (HMAC-SHA256, constant-time compare).
// 2. Process each X-GitHub-Delivery once (GitHub can redeliver).
// 3. Installation events: record which repositories the App can read.
// 4. Repository events: drop unknown repositories; mark the cached responses the event
//    changed; refresh that repository (connector -> reconcile -> store).
// Chain never writes back to GitHub (ADR-0004). Logs carry the event kind only.
const crypto = require('node:crypto');
const { send, rawBody } = require('../../lib/http');
const { changedPrefixes } = require('../../lib/webhook-events');
const { createHttpCache } = require('../../lib/store/http-cache');
const { refresh: defaultRefresh } = require('../../lib/sync');

function validSignature(secret, body, header) {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`);
  const given = Buffer.from(header);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const repoFields = (r, installationId) => {
  const [owner, name] = String(r.full_name).split('/');
  return { gh_repo_id: r.id, gh_owner: owner, gh_name: name, installation_id: installationId, is_public: !r.private };
};

function createWebhookHandler({ secret, store, appAuth, fetch, now, refresh = defaultRefresh }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Only POST is allowed.' });
    if (!secret || !store) return send(res, 503, { error: 'Webhooks are not configured.' });

    let body;
    try {
      body = await rawBody(req);
    } catch {
      return send(res, 413, { error: 'Payload too large.' });
    }
    if (!validSignature(secret, body, req.headers['x-hub-signature-256'])) {
      return send(res, 401, { error: 'Invalid signature.' });
    }

    const event = req.headers['x-github-event'];
    const delivery = req.headers['x-github-delivery'];
    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return send(res, 400, { error: 'Invalid JSON.' });
    }
    if (typeof event !== 'string' || typeof delivery !== 'string' || !delivery) {
      return send(res, 400, { error: 'Missing GitHub headers.' });
    }

    try {
      const nowIso = new Date(now()).toISOString();
      if (!(await store.recordDelivery(delivery, event, nowIso))) return send(res, 202, { status: 'duplicate' });

      if (event === 'installation' || event === 'installation_repositories') {
        const installationId = payload.installation && payload.installation.id;
        const removed = event === 'installation' && ['deleted', 'suspend'].includes(payload.action)
          ? payload.repositories || []
          : payload.repositories_removed || [];
        const added = event === 'installation' && ['created', 'unsuspend', 'new_permissions_accepted'].includes(payload.action)
          ? payload.repositories || []
          : payload.repositories_added || [];
        for (const r of added) await store.upsertRepo(repoFields(r, installationId));
        await store.removeInstallation(removed.map((r) => r.id));
        return send(res, 202, { status: 'installation', added: added.length, removed: removed.length });
      }

      const repository = payload.repository;
      const row = repository && (await store.getRepoByGhId(repository.id));
      if (!row || !row.installation_id) return send(res, 202, { status: 'ignored' });

      // Keep name, visibility and default branch current (repositories can be renamed or made private).
      const [owner, name] = String(repository.full_name || `${row.gh_owner}/${row.gh_name}`).split('/');
      const current = await store.upsertRepo({
        ...row, gh_owner: owner, gh_name: name, is_public: !repository.private,
        default_branch: repository.default_branch || row.default_branch,
      });

      const prefixes = changedPrefixes(event, payload, current);
      if (!prefixes.length) return send(res, 202, { status: 'ignored' });
      await store.markChanged(prefixes);

      const token = await appAuth.installationToken(current.installation_id);
      const cached = createHttpCache({ store, fetch, now });
      await refresh({ repoRow: current, fetch: cached, token, store, now });
      return send(res, 202, { status: 'refreshed' });
    } catch (err) {
      // App-auth and store messages are written to carry no secret (lib/github-app.js, lib/store/supabase.js).
      console.error(`webhooks/github: ${err.code || 'error'} on ${event}${['app_auth', 'store'].includes(err.code) ? ` (${err.message})` : ''}`);
      return send(res, 500, { error: 'Could not process the event.' });
    }
  };
}

function fromEnv() {
  const { createSupabaseStore } = require('../../lib/store/supabase');
  const { createAppAuth } = require('../../lib/github-app');
  const env = process.env;
  const fetch = (...args) => globalThis.fetch(...args);
  const now = () => Date.now();
  if (!env.GITHUB_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return createWebhookHandler({ secret: null, store: null });
  }
  return createWebhookHandler({
    secret: env.GITHUB_WEBHOOK_SECRET,
    store: createSupabaseStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, fetch }),
    appAuth: createAppAuth({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY, fetch, now }),
    fetch,
    now,
  });
}

const handler = fromEnv();
module.exports = handler;
module.exports.createWebhookHandler = createWebhookHandler;
module.exports.validSignature = validSignature;

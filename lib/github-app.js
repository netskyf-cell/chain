'use strict';
// GitHub App authentication (ADR-0004): a short-lived App JWT (RS256, node:crypto),
// exchanged for an installation token, cached until 5 minutes before it expires.
// The private key and tokens never leave this module in an error message or a log.
const crypto = require('node:crypto');

const API = 'https://api.github.com';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

class AppAuthError extends Error {
  constructor(message) {
    super(message);
    this.code = 'app_auth';
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// Vercel and .env files often store a PEM with literal "\n": accept both.
function normaliseKey(pem) {
  return String(pem || '').replace(/\\n/g, '\n').trim();
}

function appJwt({ appId, privateKey, nowMs }) {
  const iat = Math.floor(nowMs / 1000) - 60; // GitHub allows 60 s of clock drift
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat, exp: iat + 9 * 60, iss: String(appId) }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  let signature;
  try {
    signature = signer.sign(normaliseKey(privateKey)).toString('base64url');
  } catch {
    throw new AppAuthError('GitHub App private key could not be read');
  }
  return `${header}.${payload}.${signature}`;
}

function createAppAuth({ appId, privateKey, fetch, now }) {
  if (!appId || !privateKey) throw new AppAuthError('GitHub App is not configured');
  const tokens = new Map(); // installationId -> { token, expiresMs }

  const headers = (bearer) => ({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'chain',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${bearer}`,
  });

  async function installationToken(installationId) {
    const nowMs = now();
    const cached = tokens.get(installationId);
    if (cached && cached.expiresMs - REFRESH_MARGIN_MS > nowMs) return cached.token;
    const jwt = appJwt({ appId, privateKey, nowMs });
    const res = await fetch(`${API}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
      method: 'POST',
      headers: headers(jwt),
    });
    if (!res.ok) throw new AppAuthError(`Installation token request failed (${res.status})`);
    const body = await res.json();
    tokens.set(installationId, { token: body.token, expiresMs: Date.parse(body.expires_at) });
    return body.token;
  }

  // The installation for one repository, or null when the App is not installed there.
  async function repoInstallation(owner, name) {
    const jwt = appJwt({ appId, privateKey, nowMs: now() });
    const res = await fetch(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/installation`, {
      headers: headers(jwt),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new AppAuthError(`Installation lookup failed (${res.status})`);
    const body = await res.json();
    return body.id;
  }

  return { installationToken, repoInstallation };
}

module.exports = { createAppAuth, appJwt, AppAuthError };

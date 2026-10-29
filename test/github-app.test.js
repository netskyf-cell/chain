'use strict';
// AC-9 (S1b): App JWT, installation token cached until 5 minutes before expiry,
// no key or token in errors.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createAppAuth, appJwt } = require('../lib/github-app');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' });
const T0 = Date.parse('2026-10-29T12:00:00Z');

function fakeFetch(responses) {
  const calls = [];
  async function fetch(url, opts = {}) {
    calls.push({ url, opts });
    const r = responses.shift();
    return { ok: r.status < 300, status: r.status, json: async () => r.body };
  }
  fetch.calls = calls;
  return fetch;
}

test('the App JWT is RS256, signed by the private key, issued 60 s back, valid under 10 minutes', () => {
  const jwt = appJwt({ appId: 123, privateKey: PEM, nowMs: T0 });
  const [h, p, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(payload.iss, '123');
  assert.equal(payload.iat, T0 / 1000 - 60);
  assert.ok(payload.exp - payload.iat <= 600);
  const ok = crypto.createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, 'base64url'));
  assert.ok(ok);
});

test('a PEM stored with literal \\n (as in env files) is accepted', () => {
  assert.doesNotThrow(() => appJwt({ appId: 1, privateKey: PEM.replace(/\n/g, '\\n'), nowMs: T0 }));
});

test('AC-9: the installation token is reused until 5 minutes before it expires', async () => {
  let now = T0;
  const fetch = fakeFetch([
    { status: 201, body: { token: 'ghs_one', expires_at: '2026-10-29T13:00:00Z' } },
    { status: 201, body: { token: 'ghs_two', expires_at: '2026-10-29T14:00:00Z' } },
  ]);
  const auth = createAppAuth({ appId: 1, privateKey: PEM, fetch, now: () => now });
  assert.equal(await auth.installationToken(42), 'ghs_one');
  now = Date.parse('2026-10-29T12:54:00Z');
  assert.equal(await auth.installationToken(42), 'ghs_one', 'still 6 minutes left');
  now = Date.parse('2026-10-29T12:56:00Z');
  assert.equal(await auth.installationToken(42), 'ghs_two', 'within 5 minutes: renewed');
  assert.equal(fetch.calls.length, 2);
  assert.equal(fetch.calls[0].url, 'https://api.github.com/app/installations/42/access_tokens');
  assert.equal(fetch.calls[0].opts.method, 'POST');
  assert.match(fetch.calls[0].opts.headers.Authorization, /^Bearer ey/);
});

test('AC-9: errors never carry the key, the JWT or a token', async () => {
  const fetch = fakeFetch([{ status: 401, body: { message: 'Bad credentials' } }]);
  const auth = createAppAuth({ appId: 1, privateKey: PEM, fetch, now: () => T0 });
  await assert.rejects(auth.installationToken(42), (err) => {
    assert.equal(err.code, 'app_auth');
    assert.doesNotMatch(err.message, /BEGIN|ey[A-Za-z0-9_-]{10}|ghs_/);
    return true;
  });
  assert.throws(() => appJwt({ appId: 1, privateKey: 'not a key', nowMs: T0 }), (err) => !/not a key/.test(err.message));
  assert.throws(() => createAppAuth({ appId: '', privateKey: PEM, fetch, now: () => T0 }), /not configured/);
});

test('repoInstallation returns the id, or null when the App is not installed', async () => {
  const fetch = fakeFetch([{ status: 200, body: { id: 77 } }, { status: 404, body: {} }]);
  const auth = createAppAuth({ appId: 1, privateKey: PEM, fetch, now: () => T0 });
  assert.equal(await auth.repoInstallation('netskyf-cell', 'chain'), 77);
  assert.equal(await auth.repoInstallation('someone', 'else'), null);
  assert.equal(fetch.calls[0].url, 'https://api.github.com/repos/netskyf-cell/chain/installation');
});

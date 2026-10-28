'use strict';
// AC-12: every internal link uses /#/route; the router parses every S0 route.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesIn(p) : [p];
  });
}

test('every literal href in public/ is /#/…, a static asset, or an external https URL', () => {
  const offenders = [];
  for (const file of filesIn(PUBLIC).filter((f) => /\.(html|js)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/href\s*[=:]\s*["'`]([^"'`]+)["'`]/g)) {
      const href = m[1];
      const ok = href.startsWith('/#/') || href.startsWith('https://') || /^\/(css|js)\//.test(href);
      if (!ok) offenders.push(`${path.relative(PUBLIC, file)}: ${href}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('route() and featureRoute() always build /#/ links', async () => {
  const { route, featureRoute } = await import('../public/js/router.js');
  assert.equal(route('demo'), '/#/demo');
  assert.equal(route('/#/demo'), '/#/demo');
  assert.equal(route('demo', { repo: 'a/b' }), '/#/demo?repo=a%2Fb');
  assert.equal(featureRoute('a/b', 's0'), '/#/feature/a%2Fb/s0');
});

test('parseHash() reads every S0 route and its parameters', async () => {
  const { parseHash, featureRoute } = await import('../public/js/router.js');
  assert.deepEqual(parseHash('#/demo'), { name: 'demo', params: {}, query: {} });
  assert.deepEqual(parseHash('#/demo?repo=a%2Fb'), { name: 'demo', params: {}, query: { repo: 'a/b' } });
  assert.deepEqual(parseHash(featureRoute('netskyf-cell/chain', 's0-walking-skeleton').slice(1)), {
    name: 'feature',
    params: { repo: 'netskyf-cell/chain', slug: 's0-walking-skeleton' },
    query: {},
  });
  assert.equal(parseHash('').name, 'not-found');
  assert.equal(parseHash('#/nope').name, 'not-found');
  assert.equal(parseHash('#/feature/%E0%A4%A/x').name, 'not-found');
});

test('parseHash() reads the waiting route with its repository', async () => {
  const { parseHash, route } = await import('../public/js/router.js');
  assert.deepEqual(parseHash(route('waiting', { repo: 'a/b' }).slice(1)), { name: 'waiting', params: {}, query: { repo: 'a/b' } });
});

'use strict';
// Local development server: `npm run dev`, then open http://localhost:3000/#/demo
//
// Serves public/ as static files and routes /api/demo to the same handler that
// runs on Vercel. Reads GITHUB_DEMO_TOKEN from .env if that file exists; without
// it, GitHub allows 60 unauthenticated calls per hour, enough for local testing.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Load .env (KEY=value lines) before the handler reads process.env.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const demo = require('./api/demo');

const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  // Refuse anything outside public/ (path traversal).
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}

const state = require('./api/state');
const webhooks = require('./api/webhooks/github');

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/demo')) return demo(req, res);
  if (req.url.startsWith('/api/state')) return state(req, res);
  if (req.url.startsWith('/api/webhooks/github')) return webhooks(req, res);
  return serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    const mode = process.env.GITHUB_DEMO_TOKEN ? 'with token' : 'without token (60 GitHub calls per hour)';
    console.log(`Chain dev server on http://localhost:${PORT}/#/demo, ${mode}`);
  });
}

module.exports = server;

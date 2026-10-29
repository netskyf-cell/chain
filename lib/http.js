'use strict';
// Small helpers shared by the api/ functions (Vercel and dev-server.js).

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

// The exact bytes GitHub signed. Vercel may have read the stream into req.body already
// (a Buffer or a string); otherwise read the stream. Never re-serialise parsed JSON:
// key order and spacing would change and the signature would not match.
async function rawBody(req, limit = 5 * 1024 * 1024) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { code: 'too_large' });
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = { send, clientId, rawBody };

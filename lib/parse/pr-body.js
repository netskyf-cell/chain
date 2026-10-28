'use strict';
// Reads the linking lines of a pull request body (spec §5.5, PR template):
//   Feature: <slug>
//   Light change: <reason>
//   Capability: <slug>
// Placeholders still in angle brackets, empty values and anything inside
// HTML comments are ignored. The first real value of each line wins.

const LABELS = { feature: /^feature$/i, light: /^light change$/i, capability: /^capability$/i };

function parsePrBody(body) {
  const result = { feature: null, light: null, capability: null };
  if (typeof body !== 'string' || !body) return result;

  const text = body.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z ]+?)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2];
    if (!value || (value.startsWith('<') && value.endsWith('>'))) continue;
    for (const [key, pattern] of Object.entries(LABELS)) {
      if (result[key] === null && pattern.test(m[1])) result[key] = value;
    }
  }
  return result;
}

module.exports = { parsePrBody };

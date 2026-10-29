'use strict';
// Reads the linking lines of a pull request body (spec §5.5, PR template):
//   Feature: <slug>
//   Light change: <reason>
//   Capability: <slug>
//   Plan complete: yes   (the last build PR of a plan; marks the feature shipped)
// Placeholders still in angle brackets, empty values and anything inside
// HTML comments are ignored. The first real value of each line wins.

const LABELS = { feature: /^feature$/i, light: /^light change$/i, capability: /^capability$/i, planComplete: /^plan complete$/i };

function parsePrBody(body) {
  const result = { feature: null, light: null, capability: null, planComplete: null };
  const done = () => ({ ...result, planComplete: /^yes$/i.test(result.planComplete || '') });
  if (typeof body !== 'string' || !body) return done();

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
  return done();
}

// The "## Divergences from plan" section (PR template, spec S2): its text, or null
// when the PR declares nothing: no heading, empty, comments only, or text whose first
// word is "None" or "n/a" ("None.", "None (plan only).", "None beyond #21.").
function parseDivergences(body) {
  if (typeof body !== 'string' || !body) return null;
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^##\s+divergences from plan\s*$/i.test(l.trim()));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end === -1) end = lines.length;
  const text = lines.slice(start + 1, end).join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!text || /^(none|n\/a)(?![a-z0-9])/i.test(text)) return null;
  return text;
}

module.exports = { parsePrBody, parseDivergences };

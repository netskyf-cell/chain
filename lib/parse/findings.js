'use strict';
// Reads review findings written in the REVIEW.md format, one per line:
//   [pass] Severity: text
// Ported from chain-v1 (lib/parse/findings.js). Adds the compliance verdicts
// Met and Unverifiable, and the criterion id when the text starts with AC-n.
// Lines inside fenced code blocks are ignored, so examples never count.

const SEVERITIES = { block: 'Block', important: 'Important', nit: 'Nit', met: 'Met', unverifiable: 'Unverifiable' };
const LINE = /^\s*(?:[-*]\s+)?\[([A-Za-z-]+)\]\s*([A-Za-z]+)\s*:\s*(\S.*?)\s*$/;
const CRITERION = /^(AC-\d+)\b/i;

function lines(text) {
  const out = [];
  let inFence = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push(line);
  }
  return out;
}

// Findings of the given passes. Each: { pass, severity, criterion, text }.
function parseFindings(text, passes) {
  if (typeof text !== 'string' || !text) return [];
  const known = new Set((passes || []).map((p) => String(p).toLowerCase()));
  const findings = [];
  for (const line of lines(text)) {
    const m = line.match(LINE);
    if (!m) continue;
    const pass = m[1].toLowerCase();
    const severity = SEVERITIES[m[2].toLowerCase()];
    if (!known.has(pass) || !severity) continue;
    const c = m[3].match(CRITERION);
    findings.push({ pass, severity, criterion: c ? c[1].toUpperCase() : null, text: m[3] });
  }
  return findings;
}

// True when the text has something other than tagged finding lines (of any
// pass) and blank lines. Used to tell a person's review from an agent's.
function hasUntaggedText(text) {
  if (typeof text !== 'string' || !text) return false;
  return lines(text).some((line) => line.trim() !== '' && !LINE.test(line));
}

module.exports = { parseFindings, hasUntaggedText };

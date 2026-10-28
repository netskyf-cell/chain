'use strict';
// Reads review findings written in the REVIEW.md format, one per line:
//   [pass] Severity: text
// pass: one of the configured passes (chain.yml review.passes);
// Severity: Block, Important or Nit (case-insensitive).
// Lines inside fenced code blocks are ignored, so examples never count.

const SEVERITIES = { block: 'Block', important: 'Important', nit: 'Nit' };
const LINE = /^\s*(?:[-*]\s+)?\[([A-Za-z-]+)\]\s*([A-Za-z]+)\s*:\s*(\S.*?)\s*$/;

function parseFindings(text, passes) {
  if (typeof text !== 'string' || !text) return [];
  const known = new Set((passes || []).map((p) => String(p).toLowerCase()));
  const findings = [];
  let inFence = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(LINE);
    if (!m) continue;
    const pass = m[1].toLowerCase();
    const severity = SEVERITIES[m[2].toLowerCase()];
    if (!known.has(pass) || !severity) continue;
    findings.push({ pass, severity, text: m[3] });
  }
  return findings;
}

module.exports = { parseFindings };

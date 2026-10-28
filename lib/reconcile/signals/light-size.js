'use strict';
// light_path_large: a light PR above the size guard (ADR-0011). Attaches to the
// PR, never to a feature, so it never changes a feature's health.
const { signal } = require('./shared');

function lightPathLarge(ctx) {
  const { max_files: maxFiles, max_changed_lines: maxLines } = ctx.config.light;
  const out = [];
  for (const pr of ctx.prs) {
    if (pr.kind !== 'light') continue;
    const lines = pr.size.additions + pr.size.deletions;
    const over = [];
    if (pr.size.files > maxFiles) over.push(`${pr.size.files} files (limit ${maxFiles})`);
    if (lines > maxLines) over.push(`${lines} changed lines (limit ${maxLines})`);
    if (!over.length) continue;
    out.push(
      signal({
        kind: 'light_path_large',
        severity: 'warn',
        rule: `A light PR has more than ${maxFiles} files or ${maxLines} changed lines`,
        message: `Light PR #${pr.number} is above the size guard: ${over.join(', ')}`,
        pr: pr.number,
        evidence: { type: 'pr', url: pr.url, at: pr.mergedAt || pr.updatedAt, ref: pr.number },
      }),
    );
  }
  return out;
}

module.exports = { lightPathLarge };

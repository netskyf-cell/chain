'use strict';
// Shared rule for intent_rework and spec_rework: the earlier artifact changed
// after the later one started. Superseded when the later artifact changes again.
const { time, isAccepted, historyOf, signal } = require('./shared');

function rework(ctx, { kind, earlier, later }) {
  const out = [];
  for (const f of ctx.features) {
    if (!isAccepted(f.artifacts[earlier]) || !isAccepted(f.artifacts[later])) continue;
    const early = historyOf(ctx, f.artifacts[earlier].path);
    const late = historyOf(ctx, f.artifacts[later].path);
    if (!early || !late || early.partial || late.partial) continue; // unknown: say nothing
    const lateTimes = late.commits.map((c) => time(c.date));
    // No commit of the later artifact in the window: it started before the window.
    const start = lateTimes.length ? Math.min(...lateTimes) : -Infinity;
    for (const c of early.commits) {
      const at = time(c.date);
      if (at <= start) continue;
      if (lateTimes.some((t) => t >= at)) continue; // superseded
      out.push(
        signal({
          kind,
          severity: 'warn',
          rule: `${earlier}.md changed after ${later}.md was started, and ${later}.md has not been updated since`,
          message: `${earlier}.md changed (${c.sha.slice(0, 7)}) after ${later}.md was started; ${later}.md not updated since`,
          feature: f.slug,
          evidence: { type: 'commit', url: c.url, at: c.date, ref: c.sha },
        }),
      );
    }
  }
  return out;
}

module.exports = { rework };

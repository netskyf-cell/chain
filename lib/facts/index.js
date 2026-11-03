'use strict';
// Facts: neutral answers shown next to drift (plan P2, contract README "Facts").
// Started in, path across tools, where built, agent share, checked by.
// Pure: same context in, same facts out.

const { compareStrings } = require('../rules/shared');

const ROLE_RANK = { intent: 0, spec: 1, plan: 2, change: 3 };
const byTime = (a, b) => compareStrings(a.createdAt || a.updatedAt, b.createdAt || b.updatedAt) || compareStrings(a.id, b.id);

// Decisions connected by parents or links form one decision group.
function groups(ctx) {
  const seen = new Set();
  const out = [];
  for (const id of [...ctx.neighbours.keys()].sort()) {
    if (seen.has(id)) continue;
    const members = [];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      members.push(ctx.byId.get(cur));
      for (const n of ctx.neighbours.get(cur)) queue.push(n);
    }
    out.push(members);
  }
  return out;
}

function percent(part, whole) {
  return whole ? Math.round((100 * part) / whole) : null;
}

function sumCommits(list) {
  return list.reduce((t, c) => ({ agent: t.agent + c.agent, person: t.person + c.person, unknown: t.unknown + c.unknown }), { agent: 0, person: 0, unknown: 0 });
}

function changeFact(ctx, c) {
  const a = ctx.authorship.get(c.id);
  const latest = ctx.compliance.get(c.id);
  return {
    id: c.id,
    title: c.title,
    url: c.url,
    merged: c.change.merged,
    source: c.source,
    repository: c.change.repository ?? null,
    authorship: a.kind,
    agents: a.agents,
    ranOn: a.ranOn,
    commits: a.commits,
    checkedByPerson: ctx.personReviewed.get(c.id),
    checkedByCompliance: Boolean(latest && latest.findings.some((f) => f.severity !== 'Unverifiable')),
  };
}

function buildFacts(ctx) {
  const changes = [...ctx.changes].sort((a, b) => compareStrings(a.id, b.id)).map((c) => changeFact(ctx, c));
  const changeById = new Map(changes.map((c) => [c.id, c]));

  const decisions = groups(ctx).map((members) => {
    const ids = new Set(members.map((m) => m.id));
    const delivered = ctx.merged.filter((c) => ctx.decisionLinks(c).some((d) => ids.has(d.id)));
    const ordered = [...members].sort(byTime);
    const top = [...members].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || byTime(a, b))[0];
    const timeline = [...ordered, ...delivered].sort(byTime);
    const path = timeline.map((i) => i.source).filter((s, n, all) => n === 0 || all[n - 1] !== s);
    const built = [...new Map(delivered.map((c) => [`${c.source} ${c.change.repository ?? ''}`, { source: c.source, repository: c.change.repository ?? null }])).values()];
    const commits = sumCommits(delivered.map((c) => changeById.get(c.id).commits));
    return {
      id: top.id,
      title: top.title,
      url: top.url,
      items: ordered.map((i) => i.id),
      startedIn: { source: ordered[0].source, item: ordered[0].id, at: ordered[0].createdAt ?? null },
      path,
      changes: delivered.map((c) => c.id),
      builtIn: built.sort((a, b) => compareStrings(`${a.source} ${a.repository}`, `${b.source} ${b.repository}`)),
      commits,
      agentSharePercent: percent(commits.agent, commits.agent + commits.person + commits.unknown),
    };
  });
  decisions.sort((a, b) => compareStrings(a.id, b.id));

  const merged = changes.filter((c) => c.merged);
  const commits = sumCommits(merged.map((c) => c.commits));
  return {
    decisions,
    changes,
    team: {
      mergedChanges: merged.length,
      byAuthorship: ['person', 'agent', 'mixed', 'unknown'].reduce((o, k) => ({ ...o, [k]: merged.filter((c) => c.authorship === k).length }), {}),
      commits,
      agentSharePercent: percent(commits.agent, commits.agent + commits.person + commits.unknown),
      checkedByPerson: merged.filter((c) => c.checkedByPerson).length,
      checkedByCompliance: merged.filter((c) => c.checkedByCompliance).length,
    },
  };
}

module.exports = { buildFacts };

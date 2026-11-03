'use strict';
// Classifies who wrote and who checked a change, from the raw evidence the
// collector copied and the patterns in chain.yml (signal catalogue, section 4).
// Pure: no clock, no network.

const { parseFindings, hasUntaggedText } = require('./parse/findings');

const TRAILER = /^\s*co-authored-by\s*:\s*(.+?)\s*(<[^>]*>)?\s*$/i;

function agentForAccount(person, agents) {
  if (!person?.login) return null;
  const login = person.login.toLowerCase();
  return agents.find((a) => a.accounts.includes(login)) || null;
}

// Agents named in Co-Authored-By trailers, matched as whole words, any case.
function agentsInTrailers(trailers, agents) {
  const names = (trailers || [])
    .map((t) => (t.match(TRAILER) || [])[1])
    .filter(Boolean)
    .map((n) => n.toLowerCase());
  return agents.filter((a) => a.trailers.some((p) => names.some((n) => new RegExp(`(^|[^a-z0-9])${escape(p)}([^a-z0-9]|$)`).test(n))));
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// person, agent or unknown (a bot that matches no agent pattern).
function classifyCommit(commit, agents) {
  const byAccount = agentForAccount(commit.author, agents);
  const byTrailer = agentsInTrailers(commit.trailers, agents);
  const matched = [byAccount, ...byTrailer].filter(Boolean).map((a) => a.name);
  if (matched.length) return { kind: 'agent', agents: [...new Set(matched)] };
  if (commit.author?.isBot) return { kind: 'unknown', agents: [] };
  return { kind: 'person', agents: [] };
}

// Evidence at PR level: who opened it, branch prefix, labels.
function prEvidence(change, authorship) {
  const { agents, labels } = authorship;
  const found = [];
  const opener = agentForAccount(change.author, agents);
  if (opener) found.push({ signal: 'pr-author', agent: opener.name });
  for (const a of agents) {
    if (change.branch && a.branch_prefixes.some((p) => change.branch.startsWith(p))) found.push({ signal: 'branch-prefix', agent: a.name });
  }
  for (const l of change.labels || []) {
    if (labels.includes(l.toLowerCase())) found.push({ signal: 'label', agent: null });
  }
  return { opener, found };
}

// { kind: person|agent|mixed|unknown, agents, ranOn: cloud|local|null, commits: {agent, person, unknown} }
function classifyChange(change, authorship) {
  const { opener, found } = prEvidence(change, authorship);
  const counts = { agent: 0, person: 0, unknown: 0 };
  const names = new Set(found.map((f) => f.agent).filter(Boolean));
  for (const commit of change.commits || []) {
    const c = classifyCommit(commit, authorship.agents);
    counts[c.kind] += 1;
    c.agents.forEach((n) => names.add(n));
  }

  let kind;
  if (change.commits === null || change.commits === undefined) kind = found.length ? 'agent' : 'unknown';
  else if (counts.agent > 0 && counts.person === 0 && counts.unknown === 0) kind = 'agent';
  else if (counts.agent > 0 || (found.length && counts.person > 0)) kind = 'mixed';
  else if (counts.person > 0 && counts.unknown === 0) kind = 'person';
  else kind = found.length ? 'agent' : 'unknown';

  let ranOn = null;
  if (kind === 'agent' || kind === 'mixed') ranOn = opener ? 'cloud' : 'local';
  return { kind, agents: [...names].sort(), ranOn, commits: counts };
}

// A person's check: author is no agent and no bot, and the review approves,
// requests changes, or says something besides tagged findings.
function isPersonReview(review, authorship) {
  if (agentForAccount(review.author, authorship.agents) || review.author?.isBot) return false;
  if (review.state === 'approved' || review.state === 'changes-requested') return true;
  return hasUntaggedText(review.body);
}

// The latest review carrying findings of the review passes (default: compliance).
function latestCompliance(change, passes) {
  const reviews = [...(change.reviews || [])]
    .map((r) => ({ review: r, findings: parseFindings(r.body, passes) }))
    .filter((x) => x.findings.length)
    .sort((a, b) => (a.review.at < b.review.at ? -1 : a.review.at > b.review.at ? 1 : 0));
  return reviews.length ? reviews[reviews.length - 1] : null;
}

module.exports = { classifyCommit, classifyChange, isPersonReview, latestCompliance };

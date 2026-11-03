'use strict';
// Shared reading of an observations file for rules and facts.
// Pure: built once per run from the file and chain.yml; nothing is mutated.

const { classifyChange, isPersonReview, latestCompliance } = require('../authorship');

const DECISION_ROLES = new Set(['intent', 'spec', 'plan']);
const DAY_MS = 24 * 60 * 60 * 1000;

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function buildContext(observations, config) {
  const items = observations.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const isDecision = (i) => i && DECISION_ROLES.has(i.role);
  const changes = items.filter((i) => i.role === 'change');
  const merged = changes.filter((i) => i.change.merged).sort((a, b) => compareStrings(a.id, b.id));

  // Undirected edges between decisions: parent links and decision-to-decision links.
  const neighbours = new Map(items.filter(isDecision).map((i) => [i.id, new Set()]));
  const connect = (a, b) => {
    if (neighbours.has(a) && neighbours.has(b) && a !== b) {
      neighbours.get(a).add(b);
      neighbours.get(b).add(a);
    }
  };
  for (const i of items.filter(isDecision)) {
    if (i.parent) connect(i.id, i.parent);
    for (const l of i.links || []) connect(i.id, l.to);
  }

  // Ancestors of a decision: parents up, plus same-role decisions linked to
  // either way (a PRD page and its Epic). Sideways only between equal roles,
  // so a child linking to its parent never pulls in its siblings.
  function upward(id) {
    const seen = new Set();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur) || !byId.has(cur)) continue;
      seen.add(cur);
      const item = byId.get(cur);
      if (item.parent) queue.push(item.parent);
      for (const l of item.links || []) {
        const to = byId.get(l.to);
        if (isDecision(to) && to.role === item.role) queue.push(to.id);
      }
      for (const other of items) {
        if (isDecision(other) && other.role === item.role && (other.links || []).some((l) => l.to === cur)) queue.push(other.id);
      }
    }
    return seen;
  }

  const decisionLinks = (change) => (change.links || []).map((l) => byId.get(l.to)).filter(isDecision);

  // Decisions each merged change delivers, with all their ancestors.
  const under = new Map(merged.map((c) => [c.id, new Set(decisionLinks(c).flatMap((d) => [...upward(d.id)]))]));

  const authorship = new Map(changes.map((c) => [c.id, classifyChange(c.change, config.authorship)]));
  const personReviewed = new Map(changes.map((c) => [c.id, c.change.reviews.some((r) => isPersonReview(r, config.authorship))]));
  const compliance = new Map(changes.map((c) => [c.id, latestCompliance(c.change, config.rules.review_passes)]));

  const incomplete = new Set(observations.sources.filter((s) => !s.read || s.partial).map((s) => s.id));

  return {
    observations,
    config,
    items,
    byId,
    changes,
    merged,
    neighbours,
    under,
    authorship,
    personReviewed,
    compliance,
    incomplete,
    now: Date.parse(observations.collectedAt),
    isDecision,
    decisionLinks,
    upward,
  };
}

function signal({ rule, kind, items, message, evidence, detail }) {
  return { rule, kind, items, message, evidence, detail: detail || {} };
}

function evidenceOf(item, extra) {
  return { item: item.id, url: item.url, ...(extra || {}) };
}

module.exports = { buildContext, signal, evidenceOf, compareStrings, DAY_MS };

'use strict';
// Compares two observations files the way two collector runs should agree
// (spec AC-C6): ignores collectedAt and the order of items, sources, links,
// labels, commits and reviews. Criteria keep their order: position is meaning.

const { compareStrings } = require('./rules/shared');

const sortBy = (list, key) => [...(list || [])].sort((a, b) => compareStrings(key(a), key(b)));

function normaliseItem(item) {
  const out = { ...item, links: sortBy(item.links, (l) => `${l.to} ${l.via}`) };
  if (item.change) {
    out.change = {
      ...item.change,
      labels: item.change.labels ? [...item.change.labels].sort() : item.change.labels,
      commits: item.change.commits ? sortBy(item.change.commits, (c) => c.sha) : item.change.commits,
      reviews: sortBy(item.change.reviews, (r) => `${r.at} ${r.url}`),
    };
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
  }
  return value;
}

const text = (v) => JSON.stringify(stable(v));

// { same, differences: [plain-words lines] }
function compareObservations(a, b) {
  const differences = [];
  for (const key of ['contract', 'team']) {
    if (a[key] !== b[key]) differences.push(`${key}: "${a[key]}" vs "${b[key]}"`);
  }
  if (text(a.vocabulary || {}) !== text(b.vocabulary || {})) differences.push('vocabulary differs');

  const sourcesA = new Map(a.sources.map((s) => [s.id, s]));
  const sourcesB = new Map(b.sources.map((s) => [s.id, s]));
  for (const id of [...new Set([...sourcesA.keys(), ...sourcesB.keys()])].sort()) {
    if (!sourcesB.has(id)) differences.push(`source ${id}: only in the first file`);
    else if (!sourcesA.has(id)) differences.push(`source ${id}: only in the second file`);
    else if (text(sourcesA.get(id)) !== text(sourcesB.get(id))) differences.push(`source ${id}: differs`);
  }

  const itemsA = new Map(a.items.map((i) => [i.id, normaliseItem(i)]));
  const itemsB = new Map(b.items.map((i) => [i.id, normaliseItem(i)]));
  for (const id of [...new Set([...itemsA.keys(), ...itemsB.keys()])].sort()) {
    if (!itemsB.has(id)) differences.push(`item ${id}: only in the first file`);
    else if (!itemsA.has(id)) differences.push(`item ${id}: only in the second file`);
    else {
      const x = itemsA.get(id);
      const y = itemsB.get(id);
      const fields = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort().filter((k) => text(x[k]) !== text(y[k]));
      if (fields.length) differences.push(`item ${id}: ${fields.join(', ')} differ`);
    }
  }
  return { same: differences.length === 0, differences };
}

module.exports = { compareObservations };

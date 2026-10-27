'use strict';
// Turns a fixture folder into the { files, read } shape that scan() expects,
// the same shape the GitHub connector produces. No network.
const fs = require('node:fs');
const path = require('node:path');

function listFiles(root, dir = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

function fixtureRepo(name) {
  const root = path.join(__dirname, '..', 'fixtures', name);
  return {
    files: listFiles(root),
    read: async (p) => fs.readFileSync(path.join(root, p), 'utf8'),
  };
}

module.exports = { fixtureRepo };

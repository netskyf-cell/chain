'use strict';
// Reads the YAML frontmatter at the top of a markdown artifact.
// Never throws: a file without valid frontmatter simply has none (spec AC-1).
const YAML = require('yaml');

function parseFrontmatter(text) {
  if (typeof text !== 'string') return {};
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0].trim() !== '---') return {};

  const end = lines.indexOf('---', 1);
  if (end === -1) return {};

  try {
    const data = YAML.parse(lines.slice(1, end).join('\n'));
    const isMap = data !== null && typeof data === 'object' && !Array.isArray(data);
    return isMap ? data : {};
  } catch {
    return {};
  }
}

module.exports = { parseFrontmatter };

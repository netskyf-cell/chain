'use strict';
// Builds Chain's S0 model from a repository's file list.
//
// Input:  { files: string[], read: (path) => Promise<string> }
//         The GitHub connector and the test fixtures both produce this shape.
// Output: { paths, capabilities, features, unassigned, empty }
//
// Pure apart from calling `read`: no network of its own, no clock, no randomness.
// Same input, same output (ADR-0005). Present/absent is an observed fact, not a
// stored status (ADR-0003).
const YAML = require('yaml');
const { parseFrontmatter } = require('./parse/artifact');

const DEFAULT_PATHS = { capabilities: 'capabilities', intent: 'intent' };
const STEPS = ['intent', 'spec', 'plan'];

function cleanDir(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/^\.?\/+/, '').replace(/\/+$/, '');
  return trimmed || fallback;
}

async function readPaths(files, read) {
  if (!files.includes('chain.yml')) return { ...DEFAULT_PATHS };
  try {
    const config = YAML.parse(await read('chain.yml'));
    const paths = (config && typeof config.paths === 'object' && !Array.isArray(config.paths)) ? config.paths : {};
    return {
      capabilities: cleanDir(paths.capabilities, DEFAULT_PATHS.capabilities),
      intent: cleanDir(paths.intent, DEFAULT_PATHS.intent),
    };
  } catch {
    return { ...DEFAULT_PATHS };
  }
}

// Statement: frontmatter `statement`, else the first "> " quote line, else null.
function statementOf(text, frontmatter) {
  if (typeof frontmatter.statement === 'string' && frontmatter.statement.trim()) {
    return frontmatter.statement.trim();
  }
  const quote = text.replace(/\r\n/g, '\n').split('\n').find((line) => line.startsWith('> '));
  return quote ? quote.slice(2).trim() || null : null;
}

async function scan({ files, read }) {
  const paths = await readPaths(files, read);
  const capPrefix = `${paths.capabilities}/`;
  const intentPrefix = `${paths.intent}/`;

  // Capabilities: capabilities/<slug>.md, one level only.
  const capabilities = [];
  for (const file of files) {
    if (!file.startsWith(capPrefix) || !file.endsWith('.md')) continue;
    const name = file.slice(capPrefix.length);
    if (name.includes('/')) continue;
    const text = await read(file);
    const fm = parseFrontmatter(text);
    const slug = typeof fm.slug === 'string' && fm.slug.trim() ? fm.slug.trim() : name.slice(0, -3);
    capabilities.push({ slug, path: file, statement: statementOf(text, fm), features: [] });
  }
  capabilities.sort((a, b) => a.slug.localeCompare(b.slug));

  // Features: any folder intent/<slug>/ that contains at least one file (ADR-0002).
  const slugs = new Set();
  for (const file of files) {
    if (!file.startsWith(intentPrefix)) continue;
    const rest = file.slice(intentPrefix.length);
    const slash = rest.indexOf('/');
    if (slash > 0) slugs.add(rest.slice(0, slash));
  }

  const known = new Set(capabilities.map((c) => c.slug));
  const features = [];
  const unassigned = [];

  for (const slug of [...slugs].sort((a, b) => a.localeCompare(b))) {
    const artifacts = {};
    for (const step of STEPS) {
      const path = `${paths.intent}/${slug}/${step}.md`;
      artifacts[step] = { state: files.includes(path) ? 'present' : 'absent', path };
    }

    let capability = null;
    if (artifacts.intent.state === 'present') {
      const fm = parseFrontmatter(await read(artifacts.intent.path));
      if (typeof fm.capability === 'string' && fm.capability.trim()) capability = fm.capability.trim();
    }

    features.push({ slug, capability, artifacts });
    if (capability && known.has(capability)) {
      capabilities.find((c) => c.slug === capability).features.push(slug);
    } else {
      unassigned.push(slug);
    }
  }

  return {
    paths,
    capabilities,
    features,
    unassigned,
    empty: capabilities.length === 0 && features.length === 0,
  };
}

module.exports = { scan };

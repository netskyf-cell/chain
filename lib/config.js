'use strict';
// Reads chain.yml (spec §5.3) with defaults. A missing or malformed file never
// breaks a scan: every value falls back to its default.
const YAML = require('yaml');

const DEFAULTS = Object.freeze({
  paths: { capabilities: 'capabilities', intent: 'intent' },
  health: { stale_days: 7 },
});

function cleanDir(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/^\.?\/+/, '').replace(/\/+$/, '');
  return trimmed || fallback;
}

function isMap(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

async function readConfig({ files, read }) {
  let raw = {};
  if (files.includes('chain.yml')) {
    try {
      const parsed = YAML.parse(await read('chain.yml'));
      if (isMap(parsed)) raw = parsed;
    } catch {
      raw = {};
    }
  }
  const paths = isMap(raw.paths) ? raw.paths : {};
  const health = isMap(raw.health) ? raw.health : {};
  const stale = Number(health.stale_days);
  return {
    paths: {
      capabilities: cleanDir(paths.capabilities, DEFAULTS.paths.capabilities),
      intent: cleanDir(paths.intent, DEFAULTS.paths.intent),
    },
    health: { stale_days: Number.isFinite(stale) && stale > 0 ? stale : DEFAULTS.health.stale_days },
  };
}

module.exports = { readConfig, DEFAULTS };

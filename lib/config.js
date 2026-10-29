'use strict';
// Reads chain.yml (spec §5.3) with defaults. A missing or malformed file never
// breaks a scan: every value falls back to its default.
const YAML = require('yaml');

const DEFAULTS = Object.freeze({
  paths: { capabilities: 'capabilities', intent: 'intent' },
  health: { stale_days: 7 },
  review: { passes: ['bugs', 'security', 'compliance'], drift_passes: ['compliance'] },
  light: { max_files: 5, max_changed_lines: 150 },
});

function cleanList(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const list = [...new Set(value.filter((v) => typeof v === 'string' && /^[A-Za-z-]+$/.test(v.trim())).map((v) => v.trim().toLowerCase()))];
  return list.length ? list : [...fallback];
}

function positive(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Normalises a config object (from readConfig or a test) so every rule can rely on it.
function withDefaults(raw) {
  const c = isMap(raw) ? raw : {};
  const review = isMap(c.review) ? c.review : {};
  const light = isMap(c.light) ? c.light : {};
  const health = isMap(c.health) ? c.health : {};
  const passes = cleanList(review.passes, DEFAULTS.review.passes);
  const drift = cleanList(review.drift_passes, DEFAULTS.review.drift_passes).filter((p) => passes.includes(p));
  return {
    paths: isMap(c.paths) ? c.paths : { ...DEFAULTS.paths },
    health: { stale_days: positive(health.stale_days, DEFAULTS.health.stale_days) },
    review: { passes, drift_passes: drift },
    light: {
      max_files: positive(light.max_files, DEFAULTS.light.max_files),
      max_changed_lines: positive(light.max_changed_lines, DEFAULTS.light.max_changed_lines),
    },
  };
}

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
  return withDefaults({
    ...raw,
    paths: {
      capabilities: cleanDir(paths.capabilities, DEFAULTS.paths.capabilities),
      intent: cleanDir(paths.intent, DEFAULTS.paths.intent),
    },
  });
}

module.exports = { readConfig, withDefaults, DEFAULTS };

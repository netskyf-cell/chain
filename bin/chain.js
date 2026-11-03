#!/usr/bin/env node
'use strict';
// chain: validate, compare and run rules on an observations file.
//   chain validate [observations.json]        check against the contract
//   chain validate --config [chain.yml]       check a team configuration
//   chain compare <a.json> <b.json>           do two collector runs agree?
//   chain rules [observations.json] [--config chain.yml] [--out file]
// Exit codes: 0 ok, 1 invalid or different, 2 usage or file error.

const fs = require('node:fs');
const path = require('node:path');
const { validateObservations, validateConfig, readJson, readYaml } = require('../lib/validate');
const { compareObservations } = require('../lib/compare');
const { run, toJson } = require('../lib/engine');

const DEFAULT_OBS = path.join('chain', 'observations.json');
const DEFAULT_CONFIG = 'chain.yml';

const USAGE = `Usage:
  chain validate [observations.json]
  chain validate --config [chain.yml]
  chain compare <first.json> <second.json>
  chain rules [observations.json] [--config chain.yml] [--out verdicts.json]`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      flags[name] = next && !next.startsWith('--') ? (i += 1, next) : true;
    } else positional.push(arg);
  }
  return { positional, flags };
}

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  return code;
}

function readOrFail(file, reader) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  try {
    return reader(file);
  } catch (e) {
    throw new Error(`Cannot read ${file}: ${e.message}`);
  }
}

function report(file, problems) {
  if (!problems.length) {
    process.stdout.write(`ok   ${file}\n`);
    return 0;
  }
  process.stdout.write(`FAIL ${file}\n${problems.map((p) => `  ${p}`).join('\n')}\n`);
  return 1;
}

function validate({ positional, flags }) {
  if (flags.config) {
    const file = flags.config === true ? positional[0] || DEFAULT_CONFIG : flags.config;
    return report(file, validateConfig(readOrFail(file, readYaml)));
  }
  const file = positional[0] || DEFAULT_OBS;
  return report(file, validateObservations(readOrFail(file, readJson)));
}

function compare({ positional }) {
  if (positional.length !== 2) return fail(USAGE);
  const [a, b] = positional.map((f) => readOrFail(f, readJson));
  const { same, differences } = compareObservations(a, b);
  process.stdout.write(same ? 'same\n' : `different\n${differences.map((d) => `  ${d}`).join('\n')}\n`);
  return same ? 0 : 1;
}

function rules({ positional, flags }) {
  const file = positional[0] || DEFAULT_OBS;
  const observations = readOrFail(file, readJson);
  const problems = validateObservations(observations);
  if (problems.length) return report(file, problems);

  const configFile = typeof flags.config === 'string' ? flags.config : DEFAULT_CONFIG;
  let config = null;
  if (fs.existsSync(configFile)) {
    config = readOrFail(configFile, readYaml);
    const configProblems = validateConfig(config);
    if (configProblems.length) return report(configFile, configProblems);
  } else {
    process.stderr.write(`No ${configFile}: using defaults (no agent patterns, so authorship is person or unknown).\n`);
  }

  const out = toJson(run(observations, config));
  if (typeof flags.out === 'string') {
    fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
    fs.writeFileSync(flags.out, out);
    process.stdout.write(`wrote ${flags.out}\n`);
  } else process.stdout.write(out);
  return 0;
}

function main(argv) {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  try {
    if (command === 'validate') return validate(args);
    if (command === 'compare') return compare(args);
    if (command === 'rules') return rules(args);
    return fail(USAGE);
  } catch (e) {
    return fail(e.message);
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { main };

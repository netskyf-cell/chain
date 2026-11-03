'use strict';
// Checks an observations file and a chain.yml against the contract (ADR-0003).
// Schema first, then what a schema cannot say: unique ids, links and parents
// that point inside the file, items whose source is listed.
// Pure: takes parsed data, returns a list of plain-words problems ([] = valid).

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const YAML = require('yaml');

const contractDir = path.join(__dirname, '..', 'docs', 'contract');
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

function load(name) {
  return ajv.compile(JSON.parse(fs.readFileSync(path.join(contractDir, name), 'utf8')));
}

const schemas = {
  observations: load('observations.schema.json'),
  config: load('chain-yml.schema.json'),
};

function schemaProblems(validate, data) {
  if (validate(data)) return [];
  return validate.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`);
}

function duplicates(list) {
  return [...new Set(list.filter((x, i) => list.indexOf(x) !== i))];
}

function validateObservations(data) {
  const problems = schemaProblems(schemas.observations, data);
  if (problems.length) return problems;

  const ids = data.items.map((i) => i.id);
  for (const id of duplicates(ids)) problems.push(`duplicate item id: ${id}`);
  for (const id of duplicates(data.sources.map((s) => s.id))) problems.push(`duplicate source id: ${id}`);

  const known = new Set(ids);
  const sourceIds = new Set(data.sources.map((s) => s.id));
  for (const item of data.items) {
    if (!sourceIds.has(item.source)) problems.push(`${item.id}: source "${item.source}" is not in sources`);
    if (!item.id.startsWith(`${item.source}:`)) problems.push(`${item.id}: id does not start with its source "${item.source}:"`);
    if (item.parent && !known.has(item.parent)) problems.push(`${item.id}: parent ${item.parent} is not in the file`);
    for (const link of item.links || []) {
      if (!known.has(link.to)) problems.push(`${item.id}: link to ${link.to}, which is not in the file`);
    }
  }
  return problems;
}

function validateConfig(data) {
  const problems = schemaProblems(schemas.config, data);
  if (problems.length) return problems;

  const sourceIds = new Set(data.sources.map((s) => s.id));
  for (const id of duplicates(data.sources.map((s) => s.id))) problems.push(`duplicate source id: ${id}`);
  for (const [role, mappings] of Object.entries(data.roles)) {
    for (const m of mappings) {
      if (!sourceIds.has(m.source)) problems.push(`roles.${role}: source "${m.source}" is not in sources`);
    }
  }
  for (const id of Object.keys(data.states || {})) {
    if (!sourceIds.has(id)) problems.push(`states: source "${id}" is not in sources`);
  }
  return problems;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readYaml(file) {
  return YAML.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { validateObservations, validateConfig, readJson, readYaml };

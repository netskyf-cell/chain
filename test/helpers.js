'use strict';
// Loads the example pair and gives a fresh copy for each test to change.
const path = require('node:path');
const { readJson, readYaml } = require('../lib/validate');

const root = path.join(__dirname, '..');
const example = () => readJson(path.join(root, 'examples', 'observations.example.json'));
const config = () => readYaml(path.join(root, 'examples', 'chain.example.yml'));
const item = (obs, id) => obs.items.find((i) => i.id === id);

module.exports = { root, example, config, item };

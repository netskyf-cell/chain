'use strict';
// Validates every examples/*.json observations file against the contract schema (ADR-0003).
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const root = path.join(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'docs/contract/observations.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

let failed = 0;
for (const file of fs.readdirSync(path.join(root, 'examples')).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'examples', file), 'utf8'));
  const ids = data.items.map((i) => i.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const known = new Set(ids);
  const dangling = data.items.flatMap((i) => [i.parent, ...(i.links || []).map((l) => l.to)]).filter((id) => id && !known.has(id));
  if (validate(data) && !dupes.length && !dangling.length) {
    console.log(`ok   ${file}`);
  } else {
    failed += 1;
    console.log(`FAIL ${file}`);
    if (validate.errors) console.log(JSON.stringify(validate.errors, null, 2));
    if (dupes.length) console.log(`duplicate ids: ${dupes.join(', ')}`);
    if (dangling.length) console.log(`parent or link to unknown ids: ${dangling.join(', ')}`);
  }
}
process.exit(failed ? 1 : 0);

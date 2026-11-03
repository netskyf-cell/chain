'use strict';
// Signal catalogue section 4: who wrote and who checked a change.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withDefaults } = require('../lib/config');
const { classifyCommit, classifyChange, isPersonReview, latestCompliance } = require('../lib/authorship');
const { example, config, item } = require('./helpers');

const a = () => withDefaults(config()).authorship;
const person = (login, isBot = false) => ({ login, name: login, isBot });

test('a commit by an agent account is agent work', () => {
  assert.deepEqual(classifyCommit({ sha: '1', author: person('Copilot', true), trailers: [] }, a().agents), { kind: 'agent', agents: ['GitHub Copilot'] });
});

test('an agent co-author trailer marks the commit, whatever its case', () => {
  const c = { sha: '1', author: person('sam'), trailers: ['co-authored-by: claude <noreply@anthropic.com>'] };
  assert.deepEqual(classifyCommit(c, a().agents), { kind: 'agent', agents: ['Claude Code'] });
});

test('a person co-author does not make a commit agent work', () => {
  assert.equal(classifyCommit({ sha: '1', author: person('sam'), trailers: ['Co-Authored-By: dana <d@example.com>'] }, a().agents).kind, 'person');
});

test('trailer patterns match whole words only', () => {
  const c = { sha: '1', author: person('sam'), trailers: ['Co-Authored-By: Claudette <c@example.com>'] };
  assert.equal(classifyCommit(c, a().agents).kind, 'person');
});

test('a bot that matches no agent is unknown, not a person', () => {
  assert.equal(classifyCommit({ sha: '1', author: person('dependabot', true), trailers: [] }, a().agents).kind, 'unknown');
});

test('example: gh:41 mixed and local, gh:42 person, gh:43 agent in the cloud', () => {
  const obs = example();
  assert.deepEqual(classifyChange(item(obs, 'gh:41').change, a()), { kind: 'mixed', agents: ['Claude Code'], ranOn: 'local', commits: { agent: 1, person: 1, unknown: 0 } });
  assert.deepEqual(classifyChange(item(obs, 'gh:42').change, a()), { kind: 'person', agents: [], ranOn: null, commits: { agent: 0, person: 1, unknown: 0 } });
  assert.deepEqual(classifyChange(item(obs, 'gh:43').change, a()), { kind: 'agent', agents: ['GitHub Copilot'], ranOn: 'cloud', commits: { agent: 1, person: 0, unknown: 0 } });
});

test('an agent branch with only person commits is mixed', () => {
  const change = { ...item(example(), 'gh:42').change, branch: 'copilot/fix' };
  assert.equal(classifyChange(change, a()).kind, 'mixed');
});

test('unread commits: PR-level evidence decides, else unknown', () => {
  const gh43 = { ...item(example(), 'gh:43').change, commits: null };
  assert.equal(classifyChange(gh43, a()).kind, 'agent');
  const gh42 = { ...item(example(), 'gh:42').change, commits: null };
  assert.equal(classifyChange(gh42, a()).kind, 'unknown');
});

test('without agent patterns, nothing is agent work', () => {
  const none = withDefaults({}).authorship;
  assert.equal(classifyChange(item(example(), 'gh:43').change, none).kind, 'unknown');
  assert.equal(classifyChange(item(example(), 'gh:41').change, none).kind, 'person');
});

test("a person's review: approval, or text beyond tagged lines; never an agent account", () => {
  const obs = example();
  const [compliance, approval] = item(obs, 'gh:41').change.reviews;
  assert.equal(isPersonReview(compliance, a()), false, 'tagged lines only');
  assert.equal(isPersonReview(approval, a()), true, 'approved');
  assert.equal(isPersonReview({ ...approval, state: null, body: 'Please rename the file.' }, a()), true, 'written comment');
  assert.equal(isPersonReview({ ...approval, author: person('Copilot', true) }, a()), false, 'agent account');
});

test('the latest compliance review wins (AC-E4)', () => {
  const change = item(example(), 'gh:41').change;
  const later = { at: '2026-10-22T09:00:00Z', url: 'https://example.com/r/9', author: person('sam'), state: null, body: '[compliance] Met: AC-2 fixed' };
  const latest = latestCompliance({ ...change, reviews: [later, ...change.reviews] }, ['compliance']);
  assert.equal(latest.review.url, 'https://example.com/r/9');
  assert.equal(latestCompliance(item(example(), 'gh:42').change, ['compliance']), null);
});

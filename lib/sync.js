'use strict';
// Read, reconcile, store (S1b spec "How it works").
//
// collect(): the connector reads (S0 scan, S1a pull requests, S2 history; S1b checks
//            when an installation token is used). Facts only.
// derive():  reconcile() over those facts. Pure (ADR-0005).
// refresh(): collect + derive + store the facts snapshot and the derived rows.
// toStatePayload(): the derived model in the shape of replace_repo_state() (migration 001).
const { readRepo, readPullRequests, readHistory } = require('./connectors/github');
const { scan } = require('./scan');
const { readConfig } = require('./config');
const { reconcile, latestReviewByUser } = require('./reconcile/state');
const { parseDivergences } = require('./parse/pr-body');
const { parseFindings } = require('./parse/findings');

async function collect(repo, { fetch, token, readChecks = false }) {
  const source = await readRepo(repo, { fetch, token });
  const scanned = await scan(source);
  const config = await readConfig(source);
  const prs = await readPullRequests(repo, { fetch, token, readChecks });
  // History of the artifacts on the default branch, since the oldest merged PR in the
  // window was opened (S2 spec, decision 2).
  const paths = scanned.features.flatMap((f) => Object.values(f.artifacts).filter((a) => a.state === 'present').map((a) => a.path));
  const since = prs.merged.map((pr) => pr.createdAt).sort()[0] || null;
  const history = await readHistory(repo, { paths, since }, { fetch, token });
  return { sha: source.sha, truncated: source.truncated, scanned, config, prs, history };
}

function derive(facts, nowIso) {
  return reconcile({ model: facts.scanned, prs: facts.prs, history: facts.history.history, config: facts.config, now: nowIso });
}

function historyPartial(facts) {
  return facts.history.partial || Boolean(facts.prs.findingsPartial);
}

const changedLines = (size) => size.additions + size.deletions;

function toStatePayload(model, facts) {
  const raw = new Map([...facts.prs.open, ...facts.prs.merged].map((pr) => [pr.number, pr]));
  const passes = facts.config.review.passes;
  const findings = [];
  for (const pr of model.prs) {
    const r = raw.get(pr.number) || {};
    const sources = [
      ...(r.reviews || []).map((x) => ({ body: x.body, url: x.url || pr.url })),
      ...(r.comments || []).map((x) => ({ body: x.body, url: x.url || pr.url })),
    ];
    for (const src of sources) {
      for (const f of parseFindings(src.body, passes)) {
        findings.push({ pr_number: pr.number, pass: f.pass, severity: f.severity.toLowerCase(), excerpt: f.text.slice(0, 200), url: src.url });
      }
    }
  }
  return {
    capabilities: model.capabilities.map((c) => ({ slug: c.slug, statement: c.statement || '', owner: c.owner || null, target: c.target || null, path: c.path })),
    features: model.features.map((f) => ({ slug: f.slug, capability: f.capability || null, lifecycle: f.lifecycle, health: f.health.status, health_reason: f.health.reason })),
    artifacts: model.features.flatMap((f) => ['intent', 'spec', 'plan'].map((type) => ({
      feature: f.slug, type, state: f.artifacts[type].state, path: f.artifacts[type].path, pr_number: f.artifacts[type].pr ? f.artifacts[type].pr.number : null,
    }))),
    pull_requests: model.prs.map((p) => {
      const r = raw.get(p.number) || {};
      return {
        number: p.number, title: p.title, url: p.url, state: p.state, kind: p.kind, role: p.role,
        feature: p.features[0] || null, capability: p.capability || null, plan_complete: Boolean(p.planComplete),
        light_reason: p.light, draft: p.draft, head_sha: p.headSha, merged_at: p.mergedAt, last_activity_at: p.updatedAt,
        changes_requested: [...latestReviewByUser(r.reviews).values()].includes('CHANGES_REQUESTED'),
        checks_state: p.checksState, divergences: parseDivergences(r.body), changed_files: p.size.files, changed_lines: changedLines(p.size),
      };
    }),
    review_findings: findings,
    signals: model.signals.map((s) => ({
      kind: s.kind, severity: s.severity, rule: s.rule, message: s.message, feature: s.feature, pr_number: s.pr,
      evidence_type: s.evidence.type, evidence_ref: String(s.evidence.ref), evidence_at: s.evidence.at, evidence_url: s.evidence.url,
    })),
  };
}

// One refresh of one installed repository. `fetch` is normally the HTTP cache.
async function refresh({ repoRow, fetch, token, store, now }) {
  const repo = { owner: repoRow.gh_owner, name: repoRow.gh_name };
  // The data's age is when reading STARTED: several webhooks for one merge arrive together,
  // their refreshes overlap, and a refresh that started earlier must never overwrite one that
  // started later (found live: replace_repo_state 409s and stale state, S1b).
  const startedIso = new Date(now()).toISOString();
  const facts = await collect(repo, { fetch, token, readChecks: true });
  const nowIso = new Date(now()).toISOString();
  const model = derive(facts, nowIso);
  await store.saveSnapshot(repoRow.id, facts, startedIso);
  const stored = await store.replaceState(repoRow.id, { ...toStatePayload(model, facts), observed_at: startedIso }, startedIso);
  return { facts, model, refreshedAt: startedIso, stored: stored !== false };
}

module.exports = { collect, derive, refresh, toStatePayload, historyPartial };

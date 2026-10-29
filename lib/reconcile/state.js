'use strict';
// S1a rules: artifact state, PR linking, lifecycle, health and the waiting queue.
// Every rule is a table in intent/s1-state/spec.md; each has one function here.
//
// Pure (ADR-0005): no network, no clock (`now` is passed in), no randomness,
// inputs are never mutated. Same inputs, same output.

const { parsePrBody } = require('../parse/pr-body');
const { withDefaults } = require('../config');
const { signals: allSignals } = require('./signals');

const STEPS = ['intent', 'spec', 'plan'];
const DAY_MS = 24 * 60 * 60 * 1000;
const byNumber = (a, b) => a.number - b.number;

// ---- PR linking (spec: "Linking a PR to a feature") ----------------------

function slugsFromFiles(files, intentPath) {
  const prefix = `${intentPath}/`;
  const slugs = new Set();
  for (const f of files || []) {
    for (const p of [f.path, f.previousPath]) {
      if (!p || !p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash > 0) slugs.add(rest.slice(0, slash));
    }
  }
  return [...slugs].sort();
}

// ---- Checks (S1b, spec §6 "failing checks") ---------------------------------

const FAILED_RUN = new Set(['failure', 'timed_out', 'cancelled']);
const FAILED_STATUS = new Set(['failure', 'error']);

// Names of failing check runs and commit statuses; [] when none or not read.
function failingChecks(checks) {
  if (!checks) return [];
  return [
    ...(checks.runs || []).filter((r) => FAILED_RUN.has(r.conclusion)).map((r) => r.name),
    ...(checks.statuses || []).filter((x) => FAILED_STATUS.has(x.state)).map((x) => x.context),
  ].sort();
}

function checksState(checks) {
  if (!checks || (!(checks.runs || []).length && !(checks.statuses || []).length)) return 'none';
  return failingChecks(checks).length ? 'failing' : 'passing';
}

function classifyPr(pr, intentPath) {
  const body = parsePrBody(pr.body);
  const files = pr.files || [];
  const size = {
    files: files.length,
    additions: files.reduce((n, f) => n + (f.additions || 0), 0),
    deletions: files.reduce((n, f) => n + (f.deletions || 0), 0),
  };
  const base = {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    state: pr.mergedAt ? 'merged' : 'open',
    draft: Boolean(pr.draft),
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    mergedAt: pr.mergedAt || null,
    capability: body.capability,
    planComplete: body.planComplete,
    size,
    checksState: checksState(pr.checks),
    headSha: pr.headSha || null,
    light: null,
    role: null,
  };

  let features = slugsFromFiles(files, intentPath); // rule 1
  if (!features.length && body.feature) features = [body.feature]; // rule 2
  if (!features.length) {
    const label = (pr.labels || []).filter((l) => /^feature:.+/.test(l)).sort()[0]; // rule 3
    if (label) features = [label.slice('feature:'.length)];
  }

  if (features.length) {
    // Artifact PR: every changed file is under the intent path. Otherwise build PR.
    const allArtifacts = files.length > 0 && files.every((f) => f.path.startsWith(`${intentPath}/`));
    return { ...base, kind: 'feature', features, role: allArtifacts ? 'artifact' : 'build' };
  }
  if (body.light) return { ...base, kind: 'light', features: [], light: body.light }; // rule 4
  return { ...base, kind: 'unlinked', features: [] }; // rule 5
}

// ---- Artifact state (spec: "Artifact state") ------------------------------

function artifactState(path, presentOnDefault, openPrs) {
  const touching = openPrs.filter((pr) => (pr.files || []).some((f) => f.path === path || f.previousPath === path));
  const first = touching.sort(byNumber)[0];
  const ref = first ? { number: first.number, url: first.url } : null;
  if (presentOnDefault) return touching.length ? { state: 'revising', path, pr: ref } : { state: 'accepted', path, pr: null };
  return touching.length ? { state: 'proposed', path, pr: ref } : { state: 'absent', path, pr: null };
}

// ---- Lifecycle (spec: "Lifecycle") -----------------------------------------

const isAccepted = (a) => a.state === 'accepted' || a.state === 'revising';

function lifecycle(feature, linkedPrs, raw, olderPrs = []) {
  const { intent, spec, plan } = feature.artifacts;
  // A spec or plan with no intent at all skipped the first step: say so first.
  if (intent.state === 'absent') return 'no intent';
  if (isAccepted(plan)) {
    const builds = linkedPrs.filter((p) => p.role === 'build');
    const mergedBuilds = builds.filter((p) => p.state === 'merged');
    // Acceptance = the merged PR that CREATED plan.md. Later edits are revisions and never
    // move it (found live: plan-absorb PR #22). If the creating PR is outside the window,
    // the plan was accepted before it: every merged build counts (found live: S0, #5).
    const planAcceptedAt = raw.merged
      .filter((pr) => (pr.files || []).some((f) => f.path === plan.path && f.status === 'added'))
      .map((pr) => pr.mergedAt)
      .sort()[0];
    // Only builds merged after the plan's acceptance count (all of them if the
    // plan's PR is outside the window). The last one declares "Plan complete: yes".
    // Older completions (outside the window, found by search) count the same way.
    const olderBuilds = olderPrs.filter((p) => p.role === 'build' && p.state === 'merged');
    const after = (list) => (planAcceptedAt ? list.filter((p) => p.mergedAt > planAcceptedAt) : list);
    const afterPlan = after(mergedBuilds);
    if (after(olderBuilds).some((p) => p.planComplete)) return 'shipped';
    if (afterPlan.some((p) => p.planComplete)) return 'shipped';
    if (afterPlan.length || builds.some((p) => p.state === 'open')) return 'building';
    return 'planned';
  }
  if (isAccepted(spec)) return 'planned';
  if (isAccepted(intent)) return 'specified';
  if (intent.state === 'proposed') return 'idea';
  return 'no intent';
}

// ---- Health (spec: "Health") -----------------------------------------------

function latestReviewByUser(reviews) {
  const latest = new Map();
  for (const r of [...(reviews || [])].sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))) {
    if (r.state === 'COMMENTED') continue; // a comment does not replace a verdict
    latest.set(r.user, r.state);
  }
  return latest;
}

function health(feature, openPrs, staleDays, nowMs, featureSignals) {
  // S2: drift is checked first. Signals arrive sorted most severe, then most recent.
  const drift = featureSignals.find((s) => s.severity === 'warn' || s.severity === 'high');
  if (drift) return { status: 'drift', reason: drift.message };

  const artifactPaths = new Set(STEPS.map((s) => feature.artifacts[s].path));
  const prs = openPrs
    .filter((pr) => (pr.files || []).some((f) => artifactPaths.has(f.path) || artifactPaths.has(f.previousPath)))
    .sort(byNumber);

  for (const pr of prs) {
    const blockers = [...latestReviewByUser(pr.reviews)]
      .filter(([, state]) => state === 'CHANGES_REQUESTED')
      .map(([user]) => user)
      .sort();
    if (blockers.length) return { status: 'blocked', reason: `PR #${pr.number} has changes requested (${blockers.join(', ')})` };
  }
  for (const pr of prs) {
    const failing = failingChecks(pr.checks);
    if (failing.length) return { status: 'blocked', reason: `PR #${pr.number} has failing checks (${failing.join(', ')})` };
  }
  for (const pr of prs) {
    const idleDays = Math.floor((nowMs - Date.parse(pr.updatedAt)) / DAY_MS);
    if (nowMs - Date.parse(pr.updatedAt) > staleDays * DAY_MS) {
      return { status: 'blocked', reason: `PR #${pr.number} inactive for ${idleDays} days` };
    }
  }
  return { status: 'on track', reason: 'No open artifact PR is blocked' };
}

// ---- Main -------------------------------------------------------------------

function reconcile({ model, prs, history, config, now }) {
  const intentPath = model.paths.intent;
  const nowMs = Date.parse(now);
  const cfg = withDefaults(config);
  const staleDays = cfg.health.stale_days;
  const raw = { open: prs.open || [], merged: prs.merged || [] };
  // Merged PRs outside the window that may declare "Plan complete: yes". Lifecycle only:
  // they never feed signals, the waiting queue or the PR list.
  const inWindow = new Set([...raw.open, ...raw.merged].map((pr) => pr.number));
  const older = (prs.older || []).filter((pr) => pr.mergedAt && !inWindow.has(pr.number))
    .map((pr) => classifyPr(pr, intentPath)).sort(byNumber);

  const classified = [...raw.open, ...raw.merged].map((pr) => classifyPr(pr, intentPath)).sort(byNumber);
  const rawByNumber = new Map([...raw.open, ...raw.merged].map((pr) => [pr.number, pr]));

  // Features: those on the default branch, plus folders that exist only in an open PR.
  const known = new Map(model.features.map((f) => [f.slug, f]));
  for (const pr of raw.open) {
    for (const slug of slugsFromFiles(pr.files, intentPath)) {
      if (known.has(slug)) continue;
      const artifacts = {};
      for (const step of STEPS) artifacts[step] = { state: 'absent', path: `${intentPath}/${slug}/${step}.md` };
      known.set(slug, { slug, capability: parsePrBody(pr.body).capability, artifacts });
    }
  }

  const capabilitySlugs = new Set(model.capabilities.map((c) => c.slug));
  const bases = [...known.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((base) => {
      const artifacts = {};
      for (const step of STEPS) {
        const a = base.artifacts[step];
        artifacts[step] = artifactState(a.path, a.state === 'present' || a.state === 'accepted', raw.open);
      }
      return { slug: base.slug, capability: base.capability, artifacts };
    });

  const signals = allSignals({ features: bases, prs: classified, raw: rawByNumber, history: history || {}, config: cfg });

  const features = bases.map((feature) => {
    const linked = classified.filter((p) => p.kind === 'feature' && p.features.includes(feature.slug));
    const own = signals.filter((s) => s.feature === feature.slug);
    return {
      ...feature,
      lifecycle: lifecycle(feature, linked, raw,
        older.filter((p) => p.kind === 'feature' && p.features.includes(feature.slug))),
      health: health(feature, raw.open, staleDays, nowMs, own),
      prs: linked.map((p) => p.number),
    };
  });

  const capabilities = model.capabilities.map((c) => ({
    ...c,
    features: features.filter((f) => f.capability === c.slug).map((f) => f.slug),
  }));
  const unassigned = features.filter((f) => !f.capability || !capabilitySlugs.has(f.capability)).map((f) => f.slug);

  // Waiting queue: one row per proposed or revising artifact, oldest PR first.
  const queue = [];
  for (const f of features) {
    STEPS.forEach((step, order) => {
      const a = f.artifacts[step];
      if (a.state !== 'proposed' && a.state !== 'revising') return;
      const pr = rawByNumber.get(a.pr.number);
      queue.push({
        feature: f.slug,
        artifact: step,
        state: a.state,
        path: a.path,
        pr: { number: pr.number, url: pr.url, title: pr.title },
        since: pr.createdAt,
        ageDays: Math.floor((nowMs - Date.parse(pr.createdAt)) / DAY_MS),
        reviewers: [...(pr.requestedReviewers || [])].sort(),
        order,
      });
    });
  }
  queue.sort((a, b) => a.since.localeCompare(b.since) || a.feature.localeCompare(b.feature) || a.order - b.order);
  for (const row of queue) delete row.order;

  return {
    paths: model.paths,
    capabilities,
    features,
    unassigned,
    queue,
    prs: classified,
    signals,
    historyPartial: Object.values(history || {}).some((h) => h && h.partial),
    partial: Boolean(prs.partial),
    empty: model.empty && features.length === 0,
  };
}

module.exports = { reconcile, classifyPr, parsePrBody, latestReviewByUser, failingChecks };

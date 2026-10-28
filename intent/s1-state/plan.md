---
slug: s1-state
capability: flow-visibility
produced_with: claude-code
---
# Plan: S1a — State on demand

Derived from [`spec.md`](spec.md). Three pull requests, one per step group, tests first, the owner merges each before the next starts. Same shape as S0.

## Technical choices

| Choice | Value | Why |
|---|---|---|
| Where rules live | `lib/reconcile/state.js`, one exported `reconcile()` plus one small function per table in the spec | ADR-0005: one pure place that decides; each table testable alone |
| Input of `reconcile()` | `{ model, prs: { open, merged, partial }, config, now }` | `model` is S0's `scan()` output, unchanged; `now` is an ISO string passed in |
| PR facts shape | `{ number, title, url, author, createdAt, updatedAt, mergedAt, draft, body, labels[], requestedReviewers[], files[{ path, status, additions, deletions, previousPath }], reviews[{ user, state, submittedAt }] }` | Only what the rules use; no diff content |
| `scan()` | Unchanged | Features that exist only in a PR are added by `reconcile()`, so `scan()` keeps one job |
| Test data | Hand-built PR scenarios in `fixtures/prs/`, plus recorded responses from this repository for the connector | Rules tested on exact cases; connector tested on real shapes |

## Group A — the rules (PR 1)

No network, no UI.

| Step | Do | Files | Verified by |
|---|---|---|---|
| A1 | Test, then code: `parsePrBody(body)` | `test/pr-body.test.js`, `lib/parse/pr-body.js` | AC-1: `Feature:`, `Light change:`, `Capability:`, placeholders, empty values, HTML comments, Windows line endings |
| A2 | PR scenarios as JSON: open intent PR, revising spec PR, merged plan PR, merged build PR after plan, open build PR, light PR, unlinked PR, multi-slug PR, changes-requested review then approval, stale PR | `fixtures/prs/*.json`, built on `fixtures/conventional/` | Read by A3 to A6 |
| A3 | Test, then code: artifact state and PR-only features | `test/state.test.js`, `lib/reconcile/state.js` | AC-2, AC-3 |
| A4 | Test, then code: PR linking and artifact versus build PR | same | AC-4, AC-5 |
| A5 | Test, then code: lifecycle and health with reasons | same | AC-6, AC-7 (stale threshold from `config.health.stale_days`) |
| A6 | Test, then code: waiting queue and determinism | same | AC-8, AC-9 |

## Group B — reading pull requests (PR 2)

| Step | Do | Files | Verified by |
|---|---|---|---|
| B1 | Record this repository's real responses: open and closed PR lists, files and reviews for each, trimmed to the fields in the PR facts shape; no author emails | `fixtures/github/pulls/` | Files committed; scanned for personal data |
| B2 | Test, then code: `readPullRequests(repo, { fetch, token })` returns `{ open, merged, partial }`; closed-but-unmerged PRs dropped; at most 30 open and 30 closed; files and reviews fetched only where the spec says | `test/github.test.js`, `lib/connectors/github.js` | AC-10: call count per scenario, `partial` above 30 open PRs, token only in the header |
| B3 | Test, then code: `/api/demo` runs `scan()` then `reconcile()` with `now` from the handler's injected clock; response gains `features[].state`, `lifecycle`, `health`, `queue`, `prs` | `test/demo.test.js`, `api/demo.js` | AC-11: shape, errors and cache unchanged from S0 |

## Group C — the views (PR 3)

| Step | Do | Files | Verified by |
|---|---|---|---|
| C1 | Board: lifecycle and health as text per feature, waiting badge linking to the queue, light changes list with files and lines | `public/js/views/board.js`, `public/css/app.css` | AC-12 in a browser |
| C2 | Queue view `/#/waiting?repo=…`, route added to the router | `public/js/views/waiting.js`, `public/js/router.js`, `public/js/main.js` | AC-13; link test still green |
| C3 | Feature view: four states with icon and text, PR link when open, lifecycle, health and reason | `public/js/views/feature.js` | AC-14 |
| C4 | Docs: `CLAUDE.md` current sprint, `SETUP.md` note on call budget | `CLAUDE.md`, `SETUP.md` | Read |
| C5 | Demo moment, live, once the repository is public: open a PR with a test intent, see it `proposed` in the queue, merge, see `accepted` and `specified` | none | AC-15, screenshots in the PR. If the repository is still private, recorded data and a note in the PR |

## For every pull request

- `npm test` green, `architecture-guard` run, **Plan match**, **Divergences from plan** and **Verification** filled with evidence.
- No migration, no deploy.

## Carried to S2 (from the owner's question on drift)

The `compliance` pass in `REVIEW.md` compares a PR to `plan.md` only. S2's intent will propose extending it to the spec's acceptance criteria and the intent's non-goals, tagged `[compliance]`, so content drift against intent and spec reaches Chain's signals without Chain calling a model (ADR-0008).

---
slug: s2-drift
capability: drift-prevention
produced_with: claude-code
---
# Plan: S2 — Drift signals

Derived from [`spec.md`](spec.md). Three pull requests, tests first, each merged before the next starts. Same shape as S0 and S1a.

## Technical choices

| Choice | Value | Why |
|---|---|---|
| Where signals live | `lib/reconcile/signals/<kind>.js`, one file per signal, each `(facts, config) => signals[]` | Spec §7 and ADR-0005: one rule per function, testable alone |
| Facts the signals read | S1a PR facts, plus `reviews` and `comments` for every PR, `mergeCommitSha`, and `history[path] = [{ sha, date, prs: [numbers] }]` | Only what the seven rules need; no diff content |
| Signal shape | `{ kind, severity, rule, feature \| pr, evidence: { type, url, at } }` | AC-5; `at` is the evidence time, never "now" |
| Health | `state.js` calls the signal functions, then `drift` before `blocked` | Spec health order |
| Test data | `fixtures/drift/`: a small history with one case and one near miss per signal | AC-3 |

## Group A — the rules (PR 1)

| Step | Do | Files | Verified by |
|---|---|---|---|
| A1 | Test, then code: `parseFindings(text)` | `test/findings.test.js`, `lib/parse/findings.js` | AC-1: passes, severities, code blocks ignored, malformed lines |
| A2 | Test, then code: `parseDivergences(body)` | `test/pr-body.test.js`, `lib/parse/pr-body.js` | AC-2: None, n/a, empty, comments only, missing heading, real text |
| A3 | Drift fixture: history, PRs, reviews, comments | `fixtures/drift/*.json` | Read by A4 and A5 |
| A4 | Test, then code: the seven signal functions | `test/signals.test.js`, `lib/reconcile/signals/*.js` | AC-3, AC-4, AC-5, AC-7: fire, near miss, supersession, shape, determinism |
| A5 | Test, then code: health `drift` and the `signals` output of `reconcile()` | `test/state.test.js`, `lib/reconcile/state.js` | AC-6 |
| A6 | `REVIEW.md`: Block severity; compliance pass checks the spec's acceptance criteria and the intent's non-goals; `chain.yml` `review` defaults read by `lib/config.js` | `REVIEW.md`, `lib/config.js`, `test/config.test.js` | AC-12; config test |

## Group B — reading reviews and history (PR 2)

| Step | Do | Files | Verified by |
|---|---|---|---|
| B1 | Record real responses: reviews and inline comments for this repository's PRs, commit history of its accepted artifacts, `commits/:sha/pulls` for those commits | `fixtures/github/` | Files committed, scanned for personal data |
| B2 | Test, then code: connector reads reviews for merged PRs, inline comments for all PRs, `merge_commit_sha`, artifact history and the PRs of each commit, within the four caps; `historyPartial` | `test/github.test.js`, `lib/connectors/github.js` | AC-8: call counts per cap, partial flag, token only in the header |
| B3 | Test, then code: `/api/demo` passes history to `reconcile()` and returns `signals` and `historyPartial` | `test/demo.test.js`, `api/demo.js` | AC-9: on Chain's own recorded history, the expected signals appear |

## Group C — the views (PR 3)

| Step | Do | Files | Verified by |
|---|---|---|---|
| C1 | Feature view: signals list with kind, severity icon and text, rule, evidence link and time | `public/js/views/feature.js`, `public/js/labels.js` | AC-10 |
| C2 | Board: `drift` health with reason; size-guard warning on light changes; "history partial" notice | `public/js/views/board.js` | AC-11 |
| C3 | Docs: `CLAUDE.md` current sprint, `SETUP.md` call budget | `CLAUDE.md`, `SETUP.md` | Read |
| C4 | Demo moment: a build PR with `[compliance] Important: AC-3 not met` in its review turns the feature to `drift` with a link | none | AC-13, on recorded data plus a synthetic review, or live if the repository is public |

The last PR carries `Plan complete: yes`.

## For every pull request

`npm test` green, `architecture-guard` run, **Plan match**, **Divergences from plan** and **Verification** filled with evidence. No migration, no deploy.

## Rule revision after the first live run (2026-10-29)

A "Divergences from plan" section whose first word is `None` or `n/a` declares nothing (spec, Reading the section). Code: `lib/parse/pr-body.js` `parseDivergences()`; tests in `test/pr-body.test.js`.

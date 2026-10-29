---
slug: s2-drift
capability: drift-prevention
produced_with: claude-code
---
# Spec: S2 — Drift signals

Derived from [`intent.md`](intent.md). Features from the umbrella spec: F-21 (rework signals), F-22 (review and PR signals), F-23 (drift detail), F-27 (light-path size guard), and the drift rules of spec §7.

## Decisions on the intent's open questions

The intent was merged without written answers. These follow the intent's recommendations; change any of them in review of this PR.

| # | Question | Decision |
|---|---|---|
| 1 | Where findings are read | PR **review bodies** and **inline review comments**, for open PRs and for merged PRs in the 30-PR window. Issue-style comments on the PR are not read. |
| 2 | Commit history cost | History is read only for artifact files that are accepted, and only for commits newer than the oldest merged PR in the window. Capped (below), with a "history partial" notice. |
| 3 | Severities that count | `REVIEW.md` gains **Block** (must not merge) next to Important and Nit. `[compliance]` findings at Important or Block raise a signal. |

## How it works

```
lib/connectors/github.js   (S2) per PR: reviews, inline comments, merge commit SHA
                           (S2) per accepted artifact: commits since the window start
                           (S2) per such commit: the PRs that contain it
lib/parse/findings.js      "[pass] Severity: text" lines
lib/parse/pr-body.js       (S2) the "Divergences from plan" section
lib/reconcile/signals/*.js one pure function per signal, (facts, config) -> signals[]
lib/reconcile/state.js     health gains "drift" (checked before "blocked")
```

Every signal function is pure: no network, no clock. A signal's time is its evidence's time (a commit date, a review time, a merge time), never "now". Same inputs, same signals (ADR-0005, ADR-0008).

### New GitHub reads per scan

| Call | Count | Cap |
|---|---|---|
| `pulls/:n/reviews` for merged PRs (open PRs already read in S1a) | 1 per merged PR | 30 |
| `pulls/:n/comments` (inline review comments) for open and merged PRs | 1 per PR | 60 |
| `commits?path=<artifact>&since=<window start>` | 1 per accepted artifact | 30 |
| `commits/:sha/pulls` for each artifact commit since the window start | 1 per commit | 30 |

Over a cap, the remaining items are skipped and the response says `historyPartial: true`. With the demo token (5,000 calls per hour) and the 5-minute cache, a scan of about 200 calls stays well inside the limit.

## Signals

| Signal | Rule | Severity | Evidence | Superseded when |
|---|---|---|---|---|
| `intent_rework` | A commit changes `intent.md` after the first commit of `spec.md` | warn | the intent commit | `spec.md` has a later commit than that intent commit |
| `spec_rework` | A commit changes `spec.md` after the first commit of `plan.md` | warn | the spec commit | `plan.md` has a later commit than that spec commit |
| `plan_revised` | A build PR changes `plan.md` | info | the PR | never (information only) |
| `pr_declares_divergence` | A linked PR's "Divergences from plan" section is not empty and not "None" | warn | the PR | for a merged PR: a PR changing `plan.md` was **merged** after it, or `plan.md` has a commit dated after its merge (the plan absorbed the divergence) |
| `compliance_finding` | A review body or inline comment on a linked PR has a line `[compliance] Important: …` or `[compliance] Block: …` | high | the review or comment | never in S2 (dismissal with a reason is F-26, release 1.1) |
| `gate_bypassed` | A commit on the default branch changed an artifact and is contained in no PR | high | the commit | never in S2 |
| `light_path_large` | A light PR has more files than `light.max_files` or more changed lines than `light.max_changed_lines` | warn | the PR | never |

"First commit" and "later" compare commit dates on the default branch. When the history for a file is partial, rework signals for it are not raised, and the notice says so.

`light_path_large` attaches to the PR, not to a feature: it shows in the light changes list and never changes a feature's health. Every other signal attaches to its feature.

### Reading the "Divergences from plan" section

The text between the heading `## Divergences from plan` and the next `## ` heading, with HTML comments removed and whitespace trimmed. Empty, or text whose first word is `None` or `n/a` (any case, for example `None.`, `None (plan only).`, `None beyond those listed in #21.`), means no divergence. (Revised 2026-10-29 after the first live run, where the PR template's explanatory "None. …" lines were read as divergences.) A PR without the heading declares nothing.

### Reading findings (REVIEW.md format)

One finding per line: `[pass] Severity: text`, where pass is `bugs`, `security` or `compliance` (from `chain.yml` `review.passes`) and severity is `Block`, `Important` or `Nit`. Only passes listed in `review.drift_passes` (default `compliance`) at Important or Block raise `compliance_finding`. Lines in code blocks are ignored.

### Health (updated order, spec §6)

| Health | Rule |
|---|---|
| `drift` | The feature has an unsuperseded signal of severity `warn` or `high`. Reason: the most severe, then most recent, signal |
| `blocked` | As in S1a |
| `on track` | Otherwise |

## Acceptance criteria

| ID | Criterion | Check |
|---|---|---|
| AC-1 | `parseFindings(text)` returns `{ pass, severity, text }` for each finding line; ignores code blocks, unknown passes and malformed lines | T |
| AC-2 | `parseDivergences(body)` returns the section text or `null` for "None", empty, missing heading, comments only | T |
| AC-3 | Each of the seven signals fires on its fixture case and not on its near-miss case | T |
| AC-4 | Supersession: `intent_rework`, `spec_rework` and a merged `pr_declares_divergence` disappear when their condition is met | T |
| AC-5 | Each signal carries kind, severity, rule text, evidence (type, URL, time) and feature or PR | T |
| AC-6 | Health is `drift` with the right reason when a warn or high signal exists; `info` never changes health; `drift` is checked before `blocked` | T |
| AC-7 | Signals are deterministic and their time is the evidence time | T |
| AC-8 | The connector respects the four caps and sets `historyPartial` | T (recorded responses) |
| AC-9 | `/api/demo` returns `signals[]` and `historyPartial`; S0 and S1a behaviour unchanged | T |
| AC-10 | Feature view lists its signals with kind, severity (icon and text), rule and evidence link | B |
| AC-11 | Board shows `drift` health with its reason; light changes show the size-guard warning | B |
| AC-12 | `REVIEW.md` defines Block and the extended compliance pass (spec acceptance criteria, intent non-goals) | Read |
| AC-13 | **Demo moment:** a build PR whose review contains `[compliance] Important: AC-3 not met` turns its feature to `drift` with a link to that review | B (recorded or live) |

## REVIEW.md changes

- Severity list: **Block** (must not merge), **Important** (fix before merge), **Nit** (optional).
- Compliance pass, added checks: the PR meets the **acceptance criteria** of `intent/<slug>/spec.md` it claims to deliver, and does nothing listed under **Non-goals** in `intent/<slug>/intent.md`. Each gap is one `[compliance]` line, naming the criterion or non-goal.

## Data, routes and files

- **No database, no migration, no new secret, no new route.**
- **New files:** `lib/parse/findings.js`, `lib/reconcile/signals/*.js` (one per signal), tests and fixtures.
- **Changed:** `lib/parse/pr-body.js`, `lib/connectors/github.js`, `lib/reconcile/state.js`, `api/demo.js`, board and feature views, `REVIEW.md`.

## ADR check

| ADR | Fit |
|---|---|
| 0003 | Signals are derived on every scan; nothing stored |
| 0005 | Connector fetches; one pure function per rule decides |
| 0008 | Rules over Git history, PR facts and tagged findings; no model; every signal has its rule and evidence |
| 0011 | `light_path_large` uses the `chain.yml` thresholds |
| 0013 | No rule depends on which agent or model wrote the code or the review |

No conflict.

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Declared divergences are common | Many features show `drift` | Supersession when the plan absorbs the divergence; this is the intended pressure to keep plans true |
| Findings not in the tag format | Missed `compliance_finding` | Format in `REVIEW.md`; parser tested on real findings when the first ones exist (spike S-D) |
| Squash and merge commits | A PR commit misread as a bypass | Bypass is decided by asking GitHub which PRs contain the commit, not by matching SHAs |
| Call volume | Slower first scan | Caps, `historyPartial`, 5-minute cache |

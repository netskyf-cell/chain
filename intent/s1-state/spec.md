---
slug: s1-state
capability: flow-visibility
produced_with: claude-code
---
# Spec: S1a — State on demand

Derived from [`intent.md`](intent.md). Features from the umbrella spec: F-14 (waiting queue), F-17 (light changes), F-20 without drift (health), and the artifact state and lifecycle of spec §6.

## Decisions on the intent's open questions

The intent was merged without written answers. These follow the intent's own recommendations; change any of them in review of this PR.

| # | Question | Decision |
|---|---|---|
| 1 | Split S1 | **Yes.** This spec is S1a: state computed on demand, no database, no GitHub App. S1b (Supabase, App, webhooks, F-05) gets its own intent later. |
| 2 | Merged PRs to read | The **30** most recently closed pull requests, not 100. Reason found while specifying: deciding `shipped` and linking by changed files needs each merged PR's file list, one call per PR. 30 keeps a scan under about 70 calls. |
| 3 | `blocked` without checks | Requested changes and staleness only. Checks state comes in S1b. |
| 4 | When is a feature `shipped`? | Added 2026-10-28 by the owner, after testing on real data: a plan is built in several PRs, so the first merged build PR is not the end. The **last** build PR declares `Plan complete: yes` in its body (PR template). Until then the feature is `building`. |

## How it works

```
api/demo.js
  └─ lib/connectors/github.js   (S0) commit + tree
                                (S1a) open PRs, recent closed PRs, files and reviews per PR
  └─ lib/scan.js                (S0) features and capabilities from the default branch
  └─ lib/reconcile/state.js     (S1a, pure) states, lifecycle, health, queue, classification
        uses lib/parse/pr-body.js  (Feature:, Light change:, Capability: lines)
```

`reconcile()` takes the scan model, the pull request facts, the config and **`now`** (passed in). No network, no clock, no randomness (ADR-0005). The connector only fetches; every rule below lives in `reconcile()`.

### GitHub reads per scan (read-only)

| Call | Count |
|---|---|
| `commits/HEAD`, `git/trees` | 2 (S0) |
| `pulls?state=open&per_page=30` | 1 |
| `pulls?state=closed&per_page=30&sort=updated&direction=desc` | 1 |
| `pulls/:n/files` for each open PR and each merged PR in that list | up to 60 |
| `pulls/:n/reviews` for each open PR | up to 30 |

Closed but unmerged PRs are ignored. Above 30 open PRs, a notice says the list is partial. The 5-minute cache from S0 still applies.

## Rules

### Artifact state (per intent, spec, plan)

| State | Rule |
|---|---|
| `accepted` | The file is on the default branch, and no open PR changes it |
| `revising` | The file is on the default branch, and an open PR modifies, renames or removes it |
| `proposed` | The file is not on the default branch, and an open PR adds it |
| `absent` | Neither |

`bypassed` (accepted without a PR) needs commit history and is a drift signal: S2.

A feature exists when its folder exists on the default branch **or** in an open PR. A brand-new intent in an open PR therefore shows as a feature with intent `proposed`.

### Linking a PR to a feature (spec §5.5)

First match wins:

1. The PR changes files under `<intent path>/<slug>/` → `feature`, linked to `<slug>`. If it touches several slugs, it links to each.
2. The body has a line `Feature: <slug>` → `feature`.
3. A label `feature:<slug>` → `feature`.
4. The body has `Light change: <reason>` with a non-empty reason → `light`; an optional `Capability: <slug>` line counts it under that capability.
5. Otherwise `unlinked`.

A value wrapped in angle brackets (`<slug>`) is a template placeholder and is ignored. A PR linked to a slug that matches no feature is still `feature`, shown with "unknown feature".

A linked PR is an **artifact PR** if all its changed files are under `<intent path>/<slug>/`, otherwise a **build PR**.

### Lifecycle (per feature)

Revising counts as accepted.

| Lifecycle | Rule, checked top to bottom |
|---|---|
| `shipped` | Plan accepted, and a merged build PR linked to the feature, merged after the plan's acceptance, has the line `Plan complete: yes`. If the plan's acceptance PR is outside the 30-PR window, any such merged build PR counts |
| `building` | Plan accepted, and a linked build PR is open, or merged without `Plan complete: yes` |
| `planned` | Spec accepted (plan absent, proposed, or accepted with no build PR yet) |
| `specified` | Intent accepted |
| `idea` | Intent proposed |
| `no intent` | Intent absent (spec or plan exist alone) |

The plan's acceptance time is the `merged_at` of the **first** merged PR in the window that changed `plan.md`. Later PRs that change `plan.md` are revisions, and do not move acceptance: a plan updated after build (for example to absorb declared divergences) must not send a built feature back to `planned`. (Revised 2026-10-29 after the first live run; it was "the most recent".)

### Health (no drift until S2)

| Health | Rule |
|---|---|
| `blocked` | An open artifact PR of this feature has a latest review of `changes requested` from any reviewer, **or** has had no activity (`updated_at`) for more than `health.stale_days` days (default 7, from `chain.yml`) |
| `on track` | Otherwise |

Health always carries a reason, for example "PR #12 has changes requested" or "PR #12 inactive for 9 days".

### Waiting queue (F-14)

Every artifact in `proposed` or `revising`, one row per artifact, with: feature, artifact, state, PR number and link, age (from the PR's `created_at` to `now`), requested reviewers (users and teams). Oldest first. A PR proposing three artifacts gives three rows.

## Acceptance criteria

| ID | Criterion | Check |
|---|---|---|
| AC-1 | `parsePrBody(body)` returns `{ feature, light, capability }`; ignores `<…>` placeholders, empty values and lines inside HTML comments | T |
| AC-2 | Artifact states follow the table above for each of the four states | T (fixture) |
| AC-3 | A feature that exists only in an open PR appears with intent `proposed` | T |
| AC-4 | PR linking follows rules 1 to 5, in order, including placeholders and multi-slug PRs | T |
| AC-5 | Artifact PR versus build PR is decided by changed paths | T |
| AC-6 | Lifecycle follows the table, including `shipped` with and without the plan's acceptance PR in the window, and `building` after a merged build PR without `Plan complete: yes` | T |
| AC-7 | Health is `blocked` for changes requested and for staleness beyond `stale_days`, with the reason; `on track` otherwise | T |
| AC-8 | Queue rows: one per proposed or revising artifact, with PR, age and requested reviewers, oldest first | T |
| AC-9 | `reconcile()` is deterministic: same inputs and same `now`, same output | T |
| AC-10 | The connector stays within the call budget above and stops at 30 open PRs with a `partial` flag | T (recorded responses) |
| AC-11 | `/api/demo` returns the reconciled model; errors and cache behave as in S0 | T |
| AC-12 | Board: each feature shows its lifecycle and health as text; a badge shows the number of waiting items with a link to the queue; light changes are listed with files and lines changed | B |
| AC-13 | `/#/waiting?repo=owner/name` lists the queue with PR links and ages | B |
| AC-14 | Feature view: each node shows `accepted`, `revising`, `proposed` or `absent` as icon and text, with its PR link when open; lifecycle, health and reason are shown | B |
| AC-15 | **Demo moment:** open a PR adding an intent on a test feature; within 5 minutes Chain shows it `proposed` in the queue; after merge it is `accepted` and the feature is `specified` | B (live, needs a public repository) |

## Data, routes and files

- **No database, no migration, no new secret.** Same `GITHUB_DEMO_TOKEN` (public, read-only).
- **Routes:** `/#/waiting` (listed in `CLAUDE.md`), used with `?repo=owner/name` until sign-in exists. `/#/demo` and `/#/feature/:repo/:slug` gain state.
- **New files:** `lib/parse/pr-body.js`, `lib/reconcile/state.js`, `public/js/views/waiting.js`, tests and fixtures.
- **Changed:** `lib/connectors/github.js`, `lib/scan.js` (features from PR paths), `api/demo.js`, board and feature views.

## ADR check

| ADR | Fit |
|---|---|
| 0003 | State is derived from PR state on every scan; nothing is stored |
| 0004 | Read-only demo token, public data; the App comes in S1b |
| 0005 | Connector fetches; `reconcile()` decides, pure, with `now` passed in |
| 0008 | No AI; every rule is a table above |
| 0009 | Two views plus one (`waiting`): 3 of 8 |
| 0011 | Light changes are listed and counted, never given a lifecycle |
| 0013 | No rule depends on the agent or model that wrote a PR |

No conflict. Splitting S1 changes the umbrella spec's slice table: updated in this PR (§4 and implementation guide §4).

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Unauthenticated local use runs out of calls (60 per hour) | Local testing limited to one or two scans per hour | Use a token locally (`.env`), or the recorded fixtures |
| PRs older than the window | `shipped` or links missed on slow repositories | Window stated in the UI; S1b reads history through webhooks |
| Requested-changes reviews later dismissed | False `blocked` | Use each reviewer's latest review only |
| Repository still private | Demo moment cannot run live | Owner makes it public, as decided |

---
slug: s1-state
capability: flow-visibility
produced_with: claude-code
---
# S1 — State: see where a human decision is waiting

## Problem

S0 shows which artifacts exist on the default branch. It cannot tell an intent that waits for a decision from one that was accepted, because it does not read pull requests. That gap is the core of Chain's promise: "where is a human decision waiting right now, and for how long?" (product intent). Without pull request state, Chain is a file browser.

## Proposed outcome

From the same repository URL, a person sees:

1. **Artifact state** for each intent, spec and plan: `absent`, `proposed` (in an open PR), `accepted` (on the default branch), `revising` (accepted, and an open PR edits it). Spec §6.
2. **Feature lifecycle**: `idea`, `specified`, `planned`, `building`, `shipped`. Spec §6.
3. **The waiting queue** (F-14): every proposed artifact with its PR, age and requested reviewers, oldest first, on `/#/waiting`.
4. **PR classification** (F-17): each open or recently merged PR is `feature`, `light` or `unlinked`, using the linking rules of spec §5.5. Light changes are listed, with their size.

The demo moment: open a PR that adds an intent; Chain shows it as `proposed` in the queue. Merge it; it becomes `accepted` and the feature moves to `specified`.

### Proposed split (decision needed)

The umbrella spec puts the database, the GitHub App and webhooks (F-05) in S1. They are a separate kind of work: accounts to create, secrets to manage, a migration to apply by a person. I propose two slices:

- **S1a — state on demand.** Read pull requests through the same read-only demo path as S0, compute state in a pure `reconcile` function, show it. No database, no App. Delivers everything above.
- **S1b — persistence and sync.** Supabase, GitHub App, webhooks, cache in the database (F-05). Changes how fast data arrives, not what is shown.

This keeps each slice demonstrable and lets the state rules be tested before any infrastructure exists.

## Non-goals

- Drift signals, including `gate_bypassed` (S2). Health shows `on track` or `blocked` only.
- Sign-in, private repositories, multi-repo portfolio (S3).
- Writing anything to GitHub.

## Open questions

1. **Split S1 into S1a and S1b?** If yes, this intent covers S1a, and S1b gets its own intent.
2. **How far back to read merged PRs.** Reading every merged PR is costly on large repositories. Proposed: the last 100 closed PRs, which is one API call, and enough for `shipped` on active features.
3. **`blocked` without checks data.** Spec §6 counts failing required checks. Reading checks costs one call per PR. Proposed for S1a: requested changes and staleness only; checks in S1b.

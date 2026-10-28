---
slug: s2-drift
capability: drift-prevention
produced_with: claude-code
---
# S2 — Drift: see where execution moved away from intent, spec and plan

## Problem

S1a shows where a feature is and where a decision waits. It does not show whether what is being built still matches what was agreed. That is the third of the four questions in Chain's intent: "where did execution drift from the plan, and what is the evidence?"

Today drift is either invisible or buried:

- An intent or spec is edited after the next step started, and nobody notices the ground moved.
- A builder or an agent writes "Divergences from plan" in a PR, and it is read once, at review, then lost.
- A reviewer finds that the code does not meet the spec, and the finding stays in a comment thread.
- An artifact lands on `main` without a PR, so no human ever accepted it.
- A "light change" grows into a feature.

The owner also asked that drift be judged against the **intent and the spec**, not only the plan. The current `compliance` pass in `REVIEW.md` compares a PR with `plan.md` only.

## Proposed outcome

For a repository, Chain shows **drift signals**, each with its kind, the rule that fired, the evidence (a commit, a PR, a review comment) and when it was detected (F-21, F-22, F-23, F-27, spec §7):

| Signal | What it shows |
|---|---|
| `intent_rework` | The intent changed after the spec was started |
| `spec_rework` | The spec changed after the plan was started |
| `plan_revised` | The plan changed inside a build PR |
| `pr_declares_divergence` | A PR's "Divergences from plan" is not "None" |
| `compliance_finding` | A review finding tagged `[compliance]`, Important or Block |
| `gate_bypassed` | An artifact reached `main` without a PR |
| `light_path_large` | A light change above the size guard |

A feature with an unresolved `warn` or `high` signal has health `drift`, with the signal as its reason (spec §6, health order).

**Drift against intent and spec, without Chain reading code.** `REVIEW.md`'s `compliance` pass is extended: the reviewer, human or AI, also checks the PR against the **acceptance criteria of `spec.md`** and the **non-goals of `intent.md`**, and tags each gap `[compliance]`. Chain counts those findings. The judgement stays in the review; Chain stays deterministic (ADR-0008).

The demo moment: a build PR whose review says `[compliance] Important: AC-3 not met`, and the feature turns to `drift` with a link to that comment.

## Non-goals

- No AI in Chain: no model reads code or judges drift (ADR-0008).
- No dismissing or validating signals yet (F-26, release 1.1). Signals are shown and resolve only when superseded by an accepted revision.
- No metrics such as lead time or rework counts (F-24, 1.1).
- No database: signals are computed on demand like S1a.

## Open questions

1. **Review findings: where to read them.** Findings can be PR review bodies, inline review comments, or issue comments on the PR. Each is a separate API call per PR. Proposed: review bodies and inline comments of open PRs and of merged PRs in the window; spike S-D checks real findings first.
2. **Commit history cost.** `intent_rework`, `spec_rework` and `gate_bypassed` need the commit history of each artifact file: one call per file. Proposed: only for features with at least one accepted artifact, capped, with a "history partial" notice like S1a.
3. **Which findings count.** Spec §7 says `[compliance]` with severity Important or Block. `REVIEW.md` today defines Important and Nit only. Proposed: add **Block** to `REVIEW.md` (must not merge) and count Important and Block.

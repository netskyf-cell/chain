# ADR-0008: Drift detection is deterministic, with no AI inference in v1

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** spec §7, ADR-0005

## Context

Drift is the central claim of the product, and a person may act on it: reopen a decision, challenge a team, escalate. A claim like that has to be explainable. The playbook's own indicators for the early stages can be read from Git: elapsed time between commits, and the count of `spec.md` commits after the first `plan.md` commit. Its review model already tags each finding with the pass that produced it.

An AI model could judge whether a PR matches its plan, but that judgement varies between runs, costs tokens, and cannot be audited like a rule.

## Decision

We will derive drift only from rules over Git history, pull request facts and tagged review findings (spec §7). Each signal carries its rule name and evidence link. A signal is resolved only by a person, with a reason. No model is called by Chain in v1.

## Consequences

- Every signal can be explained and reproduced.
- Chain misses drift that leaves no structured trace. That is accepted, and the PR template and `REVIEW.md` exist to make traces.
- Precision is measured with the signal feedback feature (F-26), with a target of 80% judged valid.
- AI summaries can be added later as a labelled, optional layer on top. They would never set health.

## Alternatives considered

| Option | Why not |
|---|---|
| Model compares plan and diff | Non-deterministic, costly, not auditable |
| Keyword matching in delivery notes (first scaffold) | Fragile; depends on free text; replaced by structured signals |
| No drift detection | It is the reason the product exists |

## Evidence

Playbook, Plan and Design stage metrics (rework counted from `spec.md` and `plan.md` commit order) and the PR review play (findings logged by pass).

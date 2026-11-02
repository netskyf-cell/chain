# ADR-0001: Agents collect, rules decide

- **Status:** proposed
- **Date:** 2026-11-02
- **Deciders:** Product owner
- **Related:** [intent](../../intent/chain/intent.md), ADR-0002, ADR-0003. Carries over v1 ADR-0005 (pure reconcile) and ADR-0008 (deterministic drift).

## Context

Chain must report two kinds of drift. Traceability drift (code with no decision, decisions with no code) can be computed from links and states. Content drift (code that misses its acceptance criteria) needs a judgement about meaning, which fixed rules cannot make.

AI agents can gather data from many tools and can compare code with criteria. But an AI verdict can change between two runs on the same input. A product owner who sees one false alarm stops trusting the board.

## Decision

We will split the work in three:

1. **Agents collect.** The setup and collector agents gather and normalise data. They never decide what is drift.
2. **Judgement happens in the team's review.** The compliance review agent compares a change with its acceptance criteria and writes tagged findings (`[compliance] Important: AC-3 not met …`) in the change's review, where a person can see and dispute them.
3. **Rules decide.** The rules engine is pure code. It reads the observations file, including those findings, and gives the same answer for the same input. No AI call in the rules engine.

A change with no compliance verdict is shown as **unverified**.

## Consequences

- Board verdicts are repeatable and explainable: each signal names its rule and its evidence.
- The quality of content-drift detection depends on the review agent and on the criteria being written down. The benchmark measures it.
- The review agent writes to the code host (a review comment). It does so with the team's permissions, as part of the team's process. Chain itself stays read-only.
- We owe: a finding format both agents and rules agree on (`REVIEW.md`), and tests that pin each rule.

## Alternatives considered

| Option | Why not |
|---|---|
| Rules only, no AI | Cannot detect content drift, the most valuable signal |
| Chain's rules engine calls a model to judge drift | Verdicts not repeatable; Chain becomes the judge instead of evidencing the team's judgement |
| Let the collector also judge | Mixes gathering and judging; a wrong collection would look like drift |

## Evidence

Spike, 2026-11-02: one merged v1 pull request reviewed against its 7 acceptance criteria. 5 met, 2 not met, both missed by review, tests and a live run. Findings written in the tagged format were readable by v1's existing `compliance_finding` rule with no change.

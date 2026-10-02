---
name: spec
description: Turn a merged intent into spec.md with testable acceptance criteria, then a plan.md produced in plan mode. Use after an intent is accepted.
---

# Write a spec, then a plan

1. Read `intent/<slug>/intent.md`. If its pull request is not merged, stop and say so.
2. Write `intent/<slug>/spec.md`: scope, acceptance criteria (each testable), data and routes touched, risks. Check that nothing contradicts an ADR in `docs/adr/`.
3. If a decision is hard to reverse and has no ADR, use the `adr` skill first.
4. Open a pull request for the spec. Wait for it to be merged.
5. Enter plan mode and produce `intent/<slug>/plan.md`: ordered steps, files to touch, how each step is verified.
6. Open a pull request for the plan. Build only after it is merged.

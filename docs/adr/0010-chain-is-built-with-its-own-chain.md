# ADR-0010: Chain is built with its own chain

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** intent "Principles", spec §4, README

## Context

Chain is a public showcase of how to keep Product Management and Agile intent while adding a transparency layer in GitHub. The strongest proof is to follow the method visibly while building it. It also gives the product a first real fixture: its own repository.

## Decision

We will build Chain through the artifact chain it displays:

1. The product intent and spec exist before code (this package).
2. Each release slice starts with its own `intent/<slug>/intent.md`, then spec, then a `plan.md` produced in Claude Code plan mode, then a pull request.
3. Every hard-to-reverse decision gets an ADR before the code that depends on it.
4. All of it is accepted by merging a pull request, never by committing to the default branch.
5. Slice S0 makes Chain's own repository the first thing its demo mode renders.

## Consequences

- The repository history is the demonstration: anyone can follow a feature from intent to merge.
- Some early work is slower because the artifacts come first. That is the point being shown.
- Any lapse (a direct commit, a missing ADR) is visible to Chain itself as a signal. That is also the point.
- The method has to be light enough to use daily, or it will be skipped. The skills (`intent`, `spec`, `adr`) exist to keep it light.

## Alternatives considered

| Option | Why not |
|---|---|
| Build first, document later | Loses the demonstration, and the documentation drifts |
| Heavy documentation up front | Contradicts the playbook's aim of faster, lighter handoffs |

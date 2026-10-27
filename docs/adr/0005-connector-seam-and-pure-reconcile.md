# ADR-0005: Connectors observe, one pure function decides

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** architecture §4–5, ADR-0008

## Context

Chain will read three kinds of source in its first releases: GitHub, Claude Code session data and PM-tool work items. More will follow (other coding agents, other trackers). If each source implemented its own status logic, rules would be duplicated and results would depend on which source was read first. Drift signals have to be defensible, which means the same inputs must always give the same answer.

## Decision

We will separate observing from deciding.

1. A **connector** turns one source into normalised **observations**. It is read-only, idempotent, and holds no business rules.
2. A single **pure `reconcile` function** takes observations and configuration and returns features, artifact states and signals. It performs no I/O and reads no clock.
3. Every observation is stored in an append-only log, so derived state can be recomputed.

## Consequences

- A new source is a new connector, with no change to the rules.
- Rules are unit-tested with fixtures and no network.
- Every status can be explained from the observations behind it.
- Observation volume must be controlled: observations carry facts and references, not content bodies.
- A small amount of indirection is added up front. It is paid back when the second connector arrives.

## Alternatives considered

| Option | Why not |
|---|---|
| Each connector computes its own status | Duplicated rules, order-dependent results |
| Compute everything at read time in the UI | Slow, untestable, no audit trail |
| An event-sourcing framework | Heavier than the problem; an append-only table gives the benefit |

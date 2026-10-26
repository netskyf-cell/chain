# ADR-0012: Read other spec-driven layouts through format readers

- **Status:** **proposed** (spike S-F required before acceptance)
- **Date:** 2026-10-02
- **Deciders:** Product owner
- **Related:** ADR-0002, ADR-0005, spec F-65. Evidence: [landscape](../landscape.md)

## Context

ADR-0002 adopts one folder-per-feature convention. Other spec-driven tools write different layouts: `.specify/` (Spec Kit), `.kiro/specs/` (Kiro), `specs/` and `changes/` (OpenSpec). The intent says Chain should work with conventions teams already follow, not a format only Chain understands. Sources disagree on Kiro's exact file layout ([landscape](../landscape.md)), so no mapping is certain yet.

## Decision

We propose **format readers**: small modules in `lib/parse/formats/` that turn a tool's layout into the same normalised observations the native reader produces. Everything after that (state from pull request state, signals, views) is unchanged (ADR-0005). The detected format is shown in the UI. Files that cannot be mapped are shown as "other artifact", never dropped.

The mapping from each tool's files to `intent`, `spec` and `plan` is **decided in spike S-F** by reading real output from each tool, not from documentation. Release target: 1.1. The native reader stays the default.

## Consequences

- The audience grows beyond teams using Chain's own layout, at the cost of one reader per format.
- Each reader needs fixtures from a real repository, so tests stay honest.
- Readers are read-only and deterministic, like the native one.
- A format whose files carry no intent or plan notion may map poorly. In that case Chain shows what it has and says what is missing.

## Alternatives considered

| Option | Why not |
|---|---|
| Native layout only | Narrow audience; contradicts "use the conventions teams follow" |
| Ask teams to convert | Adoption friction; Chain would impose a format |
| Read all formats in 1.0 | Widens the first release; the seam is built in 1.0, the readers follow |

## Spike S-F

Install each tool in a scratch repository, produce one small feature, and record the real file layout. Decide the mapping and what is not mappable. Outcome sets this ADR's status.

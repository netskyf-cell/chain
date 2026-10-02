# ADR-0002: Adopt the folder-per-feature artifact chain convention

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** spec §5, ADR-0001

## Context

Chain needs a predictable place to find a feature's artifacts. The first scaffold used flat files (`intent/intent-<name>.md`). Thiga's open dojo on the AI-native SDLC (MIT licence) uses one folder per feature: `intent/<slug>/intent.md`, `spec.md`, `plan.md`, and its skills enforce that path. Teams that follow that dojo already have this layout.

## Decision

We will read `intent/<slug>/{intent,spec,plan}.md` as the artifact chain of feature `<slug>`, and `capabilities/<slug>.md` as capabilities. The folder name is the feature identifier. Paths are configurable in `chain.yml`.

## Consequences

- Chain needs no registry. A feature exists when its folder exists.
- Repos that follow the dojo work without change. Others render with unassigned features.
- Capability links and work-item links are optional frontmatter, so the convention stays compatible with files that have none.
- The first scaffold's flat naming is dropped. Nothing was built on it.

## Alternatives considered

| Option | Why not |
|---|---|
| Flat files with a status field | Status in files is a second source of truth (ADR-0003); no place for spec and plan |
| A manifest file listing features | Needs maintenance and drifts from the folders |
| A Chain-specific layout | Teams would have to adopt a format only Chain understands |

## Evidence

Thiga, "AI-Native SDLC from the trenches" dojo (MIT), module 1 Plan, which writes `intent/<slug>/intent.md`.

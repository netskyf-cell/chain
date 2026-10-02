# ADR-0001: Git is the system of record for intent, spec and plan

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner (Frédéric Gilbert)
- **Related:** intent "Principles", ADR-0007

## Context

The AI-native SDLC playbook makes each stage end by committing an artifact that the next stage reads. The chain of commits is the audit trail: who asked for what, what the agent produced, and who approved it. The playbook also says that for every artifact, one system must be named as the source of truth, and that other systems hold a copy or a link.

A visibility product could keep its own copy of this data and let users edit it. That would create a second source of truth that drifts from the first, which is the problem Chain exists to expose.

## Decision

We will treat the repository as the source of truth for `capabilities/`, `intent/<slug>/intent.md`, `spec.md` and `plan.md`. Chain stores only derived views and the observations they were derived from. Nothing in Chain's database is authoritative for these artifacts.

## Consequences

- Chain cannot "fix" a status by editing it. To change state, a team changes the repository.
- Any view can be recomputed from the repository and the observation log.
- Teams whose source of truth is another system for some artifacts use linking (ADR-0007).
- Chain is only as good as the conventions teams follow, so it tolerates missing conventions (features appear as unassigned) instead of failing.

## Alternatives considered

| Option | Why not |
|---|---|
| Chain owns the data, syncs to Git | Two sources of truth; Chain becomes the thing it warns about |
| Chain writes status into files | Pollutes artifacts and creates commit noise (see ADR-0003) |

## Evidence

Anthropic, The AI-Native SDLC playbook (2026-08-21): "Every stage commits an artifact the next stage can read", and the sidebar on legacy systems and the source of truth.

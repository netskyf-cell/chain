# ADR-0003: Status is derived from pull request state, never written in files

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** spec §6, ADR-0001, ADR-0008

## Context

In the AI-native SDLC, a person accepts an artifact by merging the pull request that proposes it. The dojo's `intent` skill states this directly: the intent is accepted later by the Product Owner when merging its pull request. Acceptance is therefore already recorded in Git, with an author and a timestamp.

An earlier Chain template had a `Status: draft | spec'd | shipped` line in each file. A hand-maintained status is exactly the kind of drift Chain is meant to surface, and it adds a commit for every transition.

## Decision

We will derive artifact state from Git:

- `proposed`: the file exists in an open pull request.
- `accepted`: the file is on the default branch after a merged pull request.
- `bypassed`: the file reached the default branch without a pull request. It is shown and flagged.

Feature lifecycle and health are computed from these states and from linked pull requests. Files carry no status field.

## Consequences

- Human gates become visible: "proposed" is where a decision is waiting.
- Skipping the gate becomes visible too (`gate_bypassed`).
- State is correct as soon as a PR is merged, with no extra step.
- Chain depends on teams using pull requests for artifacts. Teams that commit directly to the default branch show `bypassed`, which is accurate.
- The old `Status:` line is removed from the intent template.

## Alternatives considered

| Option | Why not |
|---|---|
| Status field in frontmatter | Second source of truth; drifts; commit noise |
| Status set in the Chain UI | Chain would hold authoritative state (violates ADR-0001) |
| Labels on pull requests | Manual, easy to forget, adds nothing the PR state does not already say |

## Evidence

Thiga dojo, `intent` skill: acceptance by the Product Owner at merge. Playbook, Plan stage governance: "the accept or reject decision … is recorded as the merge or the closing review."

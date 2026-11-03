# ADR-0003: Model five roles and one source-neutral observations contract

- **Status:** proposed
- **Date:** 2026-11-02
- **Deciders:** Product owner
- **Related:** [intent](../../intent/chain/intent.md), [contract](../contract/README.md), ADR-0001. Replaces v1's single folder convention (v1 ADR-0002) as the only input.

## Context

Teams record decisions in different places and words: an ADO Epic, a Confluence PRD, an `intent.md` file. Code lives on GitHub, ADO Repos or GitLab. Pull requests point to their decision with `AB#123`, a native work-item link, a URL, or nothing. AI-assisted delivery keeps adding document types.

If the rules depended on any one of these, every new tool or team would mean new rules.

## Decision

We will model **five roles** that every way of working passes through:

| Role | Question | Examples |
|---|---|---|
| intent | Why, and for whom? | Epic, PRD, `intent.md` |
| spec | What exactly, with which acceptance criteria? | Feature, spec page, `spec.md` |
| plan | In which steps? | User stories, `plan.md`, agent tasks |
| change | What work was done? | Pull request, merge request |
| outcome | What shipped? | Merged and deployed change |

Each team maps its documents to roles in `chain.yml`, through the setup agent, and keeps its own words for display.

The collector writes **one observations file** in a fixed, versioned format ([contract](../contract/README.md)). Items carry a role, a source and links, never source-specific fields the rules depend on. **The rules read only this file.** They never know whether a change came from GitHub or ADO Repos.

## Consequences

- A new tracker, wiki or code host needs a collector adapter, not new rules.
- A new document type needs a mapping line in `chain.yml`, not new code.
- The contract is the boundary between the agents and the code. Changing it is a versioned change with this record updated.
- Some source details are lost in normalisation. Each item keeps a URL back to its source.

## Alternatives considered

| Option | Why not |
|---|---|
| Rules per source (an ADO rule set, a GitHub rule set) | Rules multiply with every tool |
| Chain's own folder convention only (v1) | Fits teams that write specs in Git; the first user does not |
| Let the agent normalise freely, no fixed contract | Rules would read unpredictable input; verdicts stop being repeatable |

## Evidence

Product vision, 2026-11-02: the first user's decisions are in Azure DevOps and Confluence, code may be on several hosts, and team vocabulary varies.

## Changes

| Date | Contract | Change |
|---|---|---|
| 2026-11-02 | 0.1 | First draft |
| 2026-11-03 | 0.2 | The collector copies raw text and accounts (PR description, review bodies, commits with trailers); rules derive findings, divergences and authorship. Agent patterns move to `chain.yml`. See the [contract README](../contract/README.md#changes-from-01) and spec [`m1-agent-pack`](../../intent/m1-agent-pack/spec.md) D2, plan P1. |

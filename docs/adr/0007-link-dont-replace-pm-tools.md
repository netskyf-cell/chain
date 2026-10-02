# ADR-0007: Link to PM tools by ID, do not replace them

- **Status:** accepted
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** capability `linked-work`, spec F-40–F-44, [Agile mapping](../agile-mapping.md)

## Context

Most teams already run Jira, Linear or Azure DevOps. Auditors and regulators often already accept those systems, and other teams depend on them. The playbook says an AI-native process must fit around what exists, and offers three configurations: the repository as the source of truth, the legacy system as the source of truth, or linkage as the minimum bar, with each side holding the other's ID.

## Decision

We will support **linkage**. Artifacts carry work-item IDs in optional frontmatter (`links:`). Chain displays them, and from release 1.2 reads the linked item's status through read-only connectors. Stories, sprints and backlogs stay in the PM tool. Per artifact, one system is the source of truth, and Chain does not choose it for the team.

Chain does not write the commit SHA back into the PM tool. It is read-only. The team can add that link themselves, and the documentation shows how.

## Consequences

- No migration is asked of any team.
- Chain can flag broken links (an artifact open while its item is closed, or the reverse).
- The reverse link (commit into the work item) is the team's responsibility until a write path exists.
- Each tracker has its own authentication and data model, so each is a separate connector with its own spike.

## Alternatives considered

| Option | Why not |
|---|---|
| Replace the PM tool | Out of scope; teams will not move; contradicts the product principle |
| Repo-only, ignore PM tools | Cannot be adopted by teams that have a tool of record |
| PM tool as the only source | Weakens the GitHub-native thesis and the audit trail |

## Evidence

Playbook, sidebar "Legacy systems and the source of truth": repo as source, legacy system as source, linkage as the minimum bar.

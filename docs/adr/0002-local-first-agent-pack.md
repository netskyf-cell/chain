# ADR-0002: Ship Chain as a local-first agent pack, not a hosted service

- **Status:** proposed
- **Date:** 2026-11-02
- **Deciders:** Product owner
- **Related:** [intent](../../intent/chain/intent.md), [lessons from v1](../lessons-from-v1.md), ADR-0001. Supersedes v1 ADR-0004 (GitHub App) and ADR-0009 (Vercel and Supabase).

## Context

v1 was a hosted service: a GitHub App, webhooks, a database and a web front end. For the first user, an enterprise team:

- an outside service must pass a security review before it may read internal repositories or trackers;
- decisions live in Azure DevOps and Confluence, which a GitHub App cannot read;
- the team's coding agent (GitHub Copilot) already has MCP connectors to these tools, with the user's own access.

Coding agents now read instruction files, custom agents and skills from the repository (for example `.github/agents/*.md`, `AGENTS.md`, `.claude/skills/`), and run hooks ([landscape](../landscape.md)). A tool can be installed as files.

## Decision

We will ship Chain as files a team adds to its repository or agent configuration:

- three agent definitions (setup, compliance review, collector), each one instruction file, with an adapter per supported agent;
- optional hooks that record small facts as work happens;
- a rules engine and a board that run locally, from the observations file.

No server, no database, no sign-in in the first release. Data stays on the team's machines and in its own tools.

## Consequences

- No security review of an outside service; each source is read through a connector the user already has.
- Installation is a pull request the team merges.
- The board shows data as of the last collection, not live. Freshness depends on how often the collector runs.
- A portfolio across many teams needs their observations files gathered somewhere. That is a later decision.
- We owe: one install path per supported agent, starting with GitHub Copilot and Claude Code.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep v1's hosted service | Security review, cannot read ADO or Confluence, ~1,300 lines of plumbing |
| Hosted service inside the enterprise | Needs hosting and an owner per company; heavy for a pilot |
| Browser extension | Sees one page at a time; no access to repositories or history |

## Evidence

[Lessons from v1](../lessons-from-v1.md). The landscape lists the agent customisation files GitHub Copilot and VS Code read.

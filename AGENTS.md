# AGENTS.md

Instructions for any coding agent working on this repository (GitHub Copilot, Claude Code, others).

## Project

Chain shows product people whether what they decided is what got built. It ships as a local-first agent pack: three agents (setup, compliance review, collector), a rules engine and a local board.

Read first: [`intent/chain/intent.md`](intent/chain/intent.md), then the decision records in [`docs/adr/`](docs/adr/README.md) and the [observations contract](docs/contract/README.md).

## Load-bearing decisions (read the record before changing)

- **Agents collect, rules decide** (ADR-0001). No AI call in the rules engine. Only the compliance review agent judges, and only inside a review.
- **Local-first agent pack** (ADR-0002). No server, database or sign-in.
- **Five roles, one contract** (ADR-0003). Rules read only the observations file and never depend on which tool an item came from.
- **Read-only.** Chain's code never writes to a tracker, wiki or code host.

## Working method

1. No code before an intent, a spec and a merged plan (skills `intent`, `spec`).
2. A hard-to-reverse decision gets a decision record first (skill `adr`).
3. Branch `claude/intent-<slug>` or `copilot/<slug>`. One PR per plan step group. The owner accepts by merging.
4. Small fixes may take the light path: no intent folder, PR body has `Light change: <reason>`, under 5 files and 150 lines.
5. Every PR body has `Feature: <slug>` and a `## Divergences from plan` section ("None" if none). The last build PR of a plan has `Plan complete: yes`.
6. A person merges and publishes. Agents never push to `main`.

## Verifying your work

Before calling a task done: run the tests, validate any changed example against the contract schema, run the `architecture-guard` skill, and list what you did differently from `plan.md` under "Divergences from plan".

## Security

No secrets, tokens or personal data in any file. This repository is public: no company names, internal URLs or team details from any user of Chain.

## Anti-patterns

| Do not | Because |
|---|---|
| Write a Status line in an intent, spec or plan | State comes from pull requests |
| Put a judgement in the collector | Gathering and judging must stay apart (ADR-0001) |
| Add a source-specific field the rules read | Breaks the contract (ADR-0003) |
| Show Chain's role names on the board | Teams see their own words |

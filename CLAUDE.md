# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Skills: `intent`, `spec`, `adr`, `architecture-guard` in `.claude/skills/`.
- Hooks in `.claude/settings.json` block likely secrets in files and any push to `main` or deploy.

## Current focus

First milestone (`intent/m1-agent-pack/`) is built: contract 0.2, rules, facts, board, the three agents, install. Open: live runs of the agents against real connectors (criteria marked manual in PR #7) and the 5-PR benchmark (`docs/benchmark.md`) with the pilot team. The plan is not complete until the benchmark is recorded.

# ADR-0013: Chain is neutral to the coding agent, its interface and its model

- **Status:** accepted
- **Date:** 2026-10-27
- **Deciders:** Product owner
- **Related:** ADR-0005, ADR-0006 (generalised), ADR-0012, spec §5.2–5.4, F-15, F-16, F-25, F-50, F-70. Evidence: [landscape](../landscape.md)

## Context

The first drafts of Chain named one vendor's tools: Claude Design, Claude.ai and Claude Code. Real teams mix tools. The same team may build with GitHub Copilot in VS Code or in the Copilot app, choose a GPT or a Claude model inside it, and still use Claude Code elsewhere. A product that only recognises one vendor would mislabel or miss most of their work.

Three layers are often confused:

| Layer | Examples | Does Chain depend on it? |
|---|---|---|
| **Surface**: where a person works with an agent | Claude Code, Claude.ai, GitHub Copilot in VS Code, Copilot app, Copilot cloud agent | It labels it when a trace says so |
| **Model**: what generates the output | Claude, GPT, others | No. Shown only if a trace states it |
| **Harness**: the files that steer the agent | instructions file, skills, hooks, prompt files, custom agents, review policy, PR template | Yes. This is what the readiness check reads |

Documented facts that make a neutral design possible ([landscape](../landscape.md)):

- Agent skills (`SKILL.md`) are an open standard. VS Code reads them from `.github/skills/`, `.claude/skills/` and `.agents/skills/`.
- Copilot reads repository instructions from `.github/copilot-instructions.md` and lists `AGENTS.md` for agents. Hooks live in `.github/hooks/*.json`; VS Code can also read `.claude/settings.json` hooks.
- Copilot cloud agent names branches `copilot/…`, authors its commits as Copilot, and adds an `Agent-Logs-Url` trailer linking to its session logs.
- Claude Code adds a `Co-Authored-By` trailer naming Claude and documents an OpenTelemetry export.

## Decision

1. **Chain observes artifacts, harness and traces. It never depends on a surface or a model.** No rule, status or signal changes with the model used.
2. **Agent profiles are configuration, not code.** `chain.yml` lists, per agent, the trailers, commit authors and branch prefixes that identify it. Chain ships default profiles for Claude Code and GitHub Copilot from documented facts. A team adds another agent by adding a profile. Profiles are data read by the detection ladder; rules stay in `reconcile` (ADR-0005).
3. **The readiness check reads harness roles, not file names.** "Has an instructions file" is met by `AGENTS.md`, `CLAUDE.md` or `.github/copilot-instructions.md`; "has skills" by any of the skill folders; "has gates" by any hook location. The lists are configurable.
4. **Session data is per agent, metadata only.** ADR-0006 keeps its privacy rules and becomes one source among several: Claude Code (OpenTelemetry, spike S-A) and GitHub Copilot (session-log trailers and usage metrics, spike S-H).
5. **Neutral words in product text.** "Coding agent", "AI tool", "design tool". A vendor name appears only as an example or in a profile.
6. **The start prompt (F-70) is plain text** that works in any agent.

## Consequences

- Chain works for teams on Copilot, on Claude Code, or on both, with GPT or Claude models, without code changes.
- Profiles must follow tool changes. Each default profile cites a landscape row and is re-checked with it.
- Detection stays honest: an agent with no profile and no trace shows as `unknown`, never guessed.
- Chain's own repository keeps its `.claude/` harness and `CLAUDE.md`. That is how Chain itself was built, not a product constraint. Copilot can read `.claude/skills/` as is.

## Alternatives considered

| Option | Why not |
|---|---|
| Stay Claude-only | Misses most teams' work, including the owner's own internal context |
| Treat the model as a dimension (per-model views or rules) | The same agent can switch models mid-task; the model says little about the process Chain observes |
| Hard-code each agent in a connector | Every new agent needs a release; breaks "rules in one place" |

## Spike S-H

Run GitHub Copilot (VS Code agent mode and cloud agent) on a small feature in a scratch repository. Record: commit author and trailers, branch names, what the session logs and the repository-level metrics expose, and which fields could map a session to a feature with content off. Outcome completes the Copilot profile and the Copilot part of ADR-0006.

# ADR-0006: Coding-agent session data comes from metadata exports only

- **Status:** **proposed** (spike S-A required before acceptance)
- **Date:** 2026-10-01. Amended 2026-10-02 (OpenTelemetry first). Generalised 2026-10-27 by [ADR-0013](0013-agent-neutral.md): the rules below apply to every agent; Claude Code is the first source studied, GitHub Copilot follows in spike S-H.
- **Deciders:** Product owner
- **Related:** capability `build-transparency`, spec F-50–F-53, architecture §6.3. Evidence: [landscape](../landscape.md)

## Context

The diff shows what changed, not how the work was done: how many sessions, whether plan mode was used, which gates fired. That context builds trust in agent-written changes. Session transcripts, however, contain prompts, code and possibly secrets. Sending them to a third party would be a privacy and security problem.

Claude Code documents an OpenTelemetry export ([docs](https://code.claude.com/docs/en/monitoring-usage)). It includes metrics for sessions, pull requests, commits, cost and active time, and events for hook execution, skill activation and permission-mode changes. Prompts, responses and tool content are redacted unless enabled by environment variables. This is the documented fact. These points are **not yet verified** by this project: how a session maps to a feature, whether plan mode can be identified, and how a builder without an organisation account would set the export up.

## Decision

We propose that Chain's ingest accepts **metadata only**, from either source:

1. **OpenTelemetry export** (tested first in spike S-A), configured by the builder or an organisation.
2. **A local hook script** that computes aggregates and posts them, as a fallback if the export does not fit.

Either way, Chain's ingest uses an **allowlist of fields**. Any prompt, response or tool-content field is dropped on receipt and never stored, even if a sender includes it. The per-repository ingest token scopes what a sender can write.

## Consequences

- Strong privacy story: Chain cannot leak what it never stores.
- If OpenTelemetry fits, no custom hook has to be maintained, and the data format is Anthropic's.
- Aggregates cannot answer questions that need content. That is intended.
- Feature attribution depends on a convention (branch name or an attribute). Unattributed sessions are listed separately.
- Nothing in release 1.0 depends on this ADR.

## Alternatives considered

| Option | Why not |
|---|---|
| Upload transcripts | Privacy and security risk; large; not needed for the questions asked |
| Hook only, as first drafted | The documented export may already provide the data; a hook adds maintenance |
| Parse the repository for traces of sessions | Only commit trailers exist; too thin on its own |

## Spike S-A

1. Run Claude Code with the OpenTelemetry export to a local collector on a small feature. Record which fields arrive, with content flags off.
2. Check: feature attribution, plan-mode identification, session start and end, repository identity.
3. Check what a hook receives, for the fallback.
4. Decide the primary source and set this ADR's status.

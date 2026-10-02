# ADR-0006: Claude Code session data comes from hooks, as metadata only

- **Status:** **proposed** (spike S-A required before acceptance)
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** capability `build-transparency`, spec F-50–F-53, architecture §6.3

## Context

The diff shows what changed, not how the work was done: how many sessions, whether plan mode was used, which gates fired. That context builds trust in agent-written changes. Session transcripts, however, contain prompts, code and possibly secrets. Sending them to a third party would be a privacy and security problem, and would make the product hard to adopt in organisations.

Claude Code supports hooks (scripts run at defined events) and offers an OpenTelemetry export for organisation-level monitoring. What exactly a hook receives, and what can be computed from it, is **not yet verified** by this project.

## Decision

We propose that a hook script, installed by the builder, reads session data **locally**, computes aggregates (times, model, tool-use counts, plan-mode flag, hook decisions), and sends only those to Chain's ingest endpoint with a per-repository token. Transcripts and prompts never leave the machine. OpenTelemetry is evaluated as an alternative for organisations.

## Consequences

- Strong privacy story: Chain cannot leak what it never receives.
- The builder installs a hook, a small adoption cost. A template ships in `templates/`.
- Aggregates cannot answer questions that need content (for example "what did the prompt say"). That is intended.
- Feature attribution depends on a convention (branch name or an environment variable). Unattributed sessions are listed separately.
- Nothing in release 1.0 depends on this ADR.

## Alternatives considered

| Option | Why not (yet) |
|---|---|
| Upload transcripts | Privacy and security risk; large; not needed for the questions asked |
| OpenTelemetry only | Organisation-level setup; evaluated in the spike for the organisation tier |
| Parse the repository for traces of sessions | Only commit trailers exist; too thin on its own |

## Spike S-A

Verify: the fields a hook receives; what can be computed locally; how a session maps to a feature; the OpenTelemetry option. Outcome decides this ADR's status.

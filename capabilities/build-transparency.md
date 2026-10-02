---
slug: build-transparency
statement: Product builder can see what Claude Code did on each feature without reading transcripts
owner: fgilbert
target: 2027-Q1
---

# Capability: build-transparency

> Product builder can see what Claude Code did on each feature without reading transcripts.

**Proposed.** Added when the scope was widened to Claude Code session data. Depends on a spike ([ADR-0006](../docs/adr/0006-claude-code-sessions-via-hooks-metadata-only.md)).

## Why this matters

The diff shows what changed. It does not show how the work was done: how many sessions, which gates fired, whether verification ran before "done". That context is what makes the build trustworthy. It must be visible without exposing prompts or transcripts.

## What done looks like (delivery-based, v1)

All features linked to this capability have shipped. Session metadata (counts, durations, tool use, hook decisions) appears on the feature timeline. Prompts and transcripts never leave the builder's machine.

## Features

F-50, F-51, F-52, F-53. See [`spec.md`](../intent/chain/spec.md).

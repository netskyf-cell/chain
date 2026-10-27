---
slug: s0-walking-skeleton
capability: flow-visibility
produced_with: claude-code
---
# S0 — Walking skeleton: see Chain's own chain from a repo URL

## Problem

Chain has a full vision, a spec and thirteen decisions, but no running code. Until something renders, none of the choices are tested against reality: the folder convention (ADR-0002), the parser, the hash routing, the vanilla front end (ADR-0009). The longer the first end-to-end path waits, the more those choices rest on paper only.

## Proposed outcome

A person pastes the URL of a **public** GitHub repository and, without signing in, sees:

1. **A capability board** (F-10, static): one card per `capabilities/*.md` file, showing its statement and the features linked to it.
2. **A feature chain** (F-12, static): for one feature, the `intent` → `spec` → `plan` nodes, each shown as present or absent on the default branch, with its file path.

The demo moment: paste `github.com/netskyf-cell/chain`, see Chain's own capabilities, open `s0-walking-skeleton` and see its own chain.

Features served: F-04 (demo mode, public repos only), F-03 (repository scan, default branch only), F-10 and F-12 (static versions).

## Non-goals

- No sign-in, no GitHub App, no webhooks, no database. Those come in S1.
- No pull request state. Nodes show present or absent only; `proposed`, `accepted` and lifecycle come in S1.
- No drift signals (S2), no portfolio, no settings.
- No source-surface labels, design node or previews (S4).
- No private repositories.

## Open questions

1. **Where the GitHub calls run.** The spec routes them through a server-side function with a read-only demo token (rate limit 5,000 calls per hour), not from the browser (60 per hour unauthenticated). That means a Vercel project in S0, earlier than SETUP.md says for Supabase. Confirm this is acceptable, or allow an unauthenticated browser-only mode for local development.
2. **Caching.** F-04 says responses are cached. Without a database in S0, the cache is in memory per function instance. Acceptable for a demo?
3. **Fixture repository.** Tests need a small hand-built repo in `fixtures/`, including one that ignores the convention. Confirm it lives in this repository.

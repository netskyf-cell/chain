# CLAUDE.md

## Project
Chain — decision and transparency layer on top of GitHub. Read `intent/chain/intent.md` and `intent/chain/spec.md` first. Architecture: `docs/architecture.md`. Decisions: `docs/adr/`. How to build: `docs/implementation-guide.md`. Claims about other tools must link to `docs/landscape.md`.

Stack: vanilla HTML + CSS variables + ES modules, hash routing, Vercel serverless (CommonJS), dedicated Supabase (ADR-0009).

## Load-bearing decisions (read the ADR before changing)
- Git is the system of record (0001). Folder per feature: `intent/<slug>/{intent,spec,plan}.md` (0002).
- Status is derived from PR state, never written in files (0003).
- GitHub App, read-only (0004). No writes to GitHub or PM tools in v1 (0004, 0007).
- Connectors observe; `reconcile` is pure and deterministic (0005).
- Drift is rule-based, no AI inference (0008).
- Session data: metadata only, OpenTelemetry first, proposed, pending spike S-A (0006).
- Small changes take a light path with a size guard (0011). Other spec layouts via format readers, proposed, pending spike S-F (0012).

## Structure
```
public/        front end (index.html, css/, js/ views and router)
api/           Vercel functions: webhook, demo, ingest
lib/           connectors/, reconcile/, parse/, store/
fixtures/      small hand-built repository for tests and demo
migrations/    SQL files; never alter production tables directly
```

## Routes (always `/#/route`)
`/#/` · `/#/capability/:slug` · `/#/feature/:repo/:slug` · `/#/waiting` · `/#/portfolio` · `/#/readiness/:repo` · `/#/settings` · `/#/demo`

## Tables
repos, capabilities, features, artifacts, pull_requests, review_findings, signals, sessions, hook_decisions, links, observations, sync_cache. RLS on every table. Each has `created_at`, `updated_at`.

## Environment variables (Vercel, never in code)
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_DEMO_TOKEN` (read-only), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (api/ only). The Supabase anon key may be in the front end. Needed by slice: demo token S0; Supabase and GitHub App S1 (see SETUP.md).

## Design tokens
Taken from the Claude Design export (see `design/README.md`). Use CSS variables only. Status must never rely on colour alone.

## Security
- No secrets in code or comments. Validate all input in `api/`. Rate-limit public endpoints.
- No private data in logs. No transcripts or prompts stored.

## Verifying your work
Before saying a task is done: run the tests (`npm test`), open the page in a browser and check the golden path, run the `architecture-guard` skill, and list anything you did differently from `plan.md`. Put that list in the PR under "Divergences from plan".

## Working method
1. No code before an intent, a spec and a merged plan (skills: `intent`, `spec`).
2. Hard-to-reverse decision → ADR first (skill: `adr`).
3. Branch `claude/intent-<slug>`; one PR per plan step group; the owner accepts by merging. A small fix (a typo, a dependency bump, a bug with no change of intent) may use the light path: no intent folder, and the PR body has `Light change: <reason>`. Keep it under 5 files and 150 lines. The last build PR of a plan carries `Plan complete: yes`; that is what marks the feature `shipped`.
4. A person pushes to production and applies migrations. Hooks enforce this.

## Anti-patterns
| Do not | Because |
|---|---|
| Add a Status line to a file | State is derived (0003) |
| Link without `/#/` | Refresh 404 on static hosting |
| Put rules in a connector | Breaks determinism (0005) |
| Hardcode a GitHub token | Use the App, demo token server-side only |

## Current sprint
Slice S1b — persistence and sync: shipped (`intent/s1b-sync/`). Live at https://chain-nine-theta.vercel.app.
- **How it runs:** Supabase (`migrations/001`, `002`), the read-only GitHub App "Chain (netskyf)" installed on this repository, and webhooks to `/api/webhooks/github`.
- **Merge test:** a merge shows on the board within seconds.

Next: S3 spec (sign-in, portfolio, settings) in `intent/s3-connect/spec.md`. Spike S-B passed on 2026-10-30: the same App signs users in, with "Email addresses: read" (ADR-0004).

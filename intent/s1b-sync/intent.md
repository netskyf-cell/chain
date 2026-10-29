---
slug: s1b-sync
capability: flow-visibility
produced_with: claude-code
---
# S1b — Persistence and sync: state stays fresh without re-reading GitHub

## Problem

Since S0, Chain rebuilds everything from GitHub on every page load: the tree, every pull request, every review, every artifact history. That works for a demo, and it stops working for real use:

- **It is slow and costly.** About 60 GitHub calls for Chain's own repository, up to about 270 for a busy one, on every load (5-minute in-memory cache only).
- **It is not fresh.** A merge shows up only when someone reloads after the cache expires.
- **It forgets.** Nothing is kept, so there is no audit trail of how a state was derived, and S3 (sign-in, several repositories, a portfolio) has nowhere to keep who connected what.
- **Private repositories are out of reach.** Demo mode has only a public read token.

The demo moment for this slice (spec §4): **a merge shows on the board within a minute, without reloading.**

## Proposed outcome

1. **A database (Supabase).** Chain keeps:
   - what it observed: normalised facts, with no file bodies, prompts or transcripts
   - what it derived from those facts: features, artifacts, PRs and signals
   - an HTTP cache with ETags

   The schema starts from `migrations/001_initial_schema.sql`, with RLS on every table (ADR-0009).
2. **The Chain GitHub App, read-only** (ADR-0004). Installation tokens are minted server-side. Webhooks for push, pull request and pull request review arrive at `/api/webhooks/github`, with the signature checked on the raw body. Events for repositories that are not connected are dropped.
3. **Webhook-driven refresh** (F-05, ADR-0014 proposed):
   - **Re-read only what changed.** An event triggers a re-read of only the PR or path it names, and `reconcile()` runs again on the stored facts.
   - **Fallback when no webhook arrives.** A page load refreshes data older than 5 minutes; unchanged resources come back as `304` and cost nothing.
4. **Checks state.** The `blocked` health rule in spec §6 includes "failing required checks". S1a skipped it, and S1b reads it.
5. **The board updates itself.** The page polls Chain's own API, not GitHub, about every 30 seconds while it is open, so a merge appears within a minute.

`reconcile()` stays pure and unchanged in shape (ADR-0005). The database stores its inputs and outputs, never rules.

## Non-goals

- No sign-in, portfolio or settings view (S3). In S1b, the App is installed on Chain's own repository by the owner.
- No writes to GitHub: no comments, no statuses, no check runs (ADR-0004).
- No dismissing signals (F-26, release 1.1).
- No GraphQL (ADR-0014, revisit trigger stated there).
- Demo mode for public repositories keeps working as today. It may use the cache, but never needs sign-in.

## Open questions

1. **The existing migration.** `001_initial_schema.sql` was written before S1a and S2. It lacks the `role` column (artifact or build PR), `plan_complete`, and signal fields such as `rule` and evidence type. It has never been applied. Proposed: revise `001` before its first application rather than adding `002` immediately. The owner applies it (CLAUDE.md working method 4).
2. **Where reconcile runs.** Proposed: in the webhook function, right after the facts for that repository are stored, over all the repository's stored facts. That is a few hundred rows, well within a serverless call.
3. **Required checks.** Reading whether a check is *required* needs branch-protection access, which the read-only App may lack (spec open question 6). Proposed: treat any failing check run on the PR's head commit as failing. Say "required" only where branch protection is readable.
4. **Live updates.** Proposed: polling every 30 seconds while the page is visible, not Supabase Realtime. It is simpler and fits the vanilla front end (ADR-0009). Realtime is a later option.
5. **Owner setup.** S1b needs a Supabase project and a registered GitHub App, created by the owner with step-by-step instructions in `SETUP.md`. Proposed: the plan starts with that setup step and the S-B hands-on check from ADR-0004, since the same App serves S3.

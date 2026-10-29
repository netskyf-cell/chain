---
slug: s1b-sync
capability: flow-visibility
produced_with: claude-code
---
# Plan: S1b — Persistence and sync

Built from [`spec.md`](spec.md). Four groups, one PR each. The last build PR carries `Plan complete: yes`.

## Technical choices

- **No new dependency:**
  - The App JWT is RS256 with `node:crypto`.
  - Supabase is reached with `fetch` to PostgREST (`/rest/v1/...`) and one RPC function for the replace-in-one-transaction write.
  - The webhook signature is HMAC-SHA256 with `node:crypto`, compared with `timingSafeEqual`.
- **Everything injectable:** `fetch`, `now`, the store and the secrets are passed in, as in `api/demo` since S0. Tests replay recorded GitHub responses and use an in-memory store with the same interface as `lib/store/supabase.js`.
- **`reconcile()` untouched** except for the checks reason in `health()` (AC-7). Its existing tests must pass unchanged (AC-6).
- **Functions** keep the `api/demo` shape (`createXHandler({ ... })`), so `dev-server.js` can route them locally.

## Group 0 — owner setup and decisions (PR 1, no code)

| Step | Do | Files | Verified by |
|---|---|---|---|
| 0.1 | Amend ADR-0004: add the read-only repository permissions **Checks** and **Commit statuses**, and the webhook events `check_run`, `check_suite`, `status`, `installation`, `installation_repositories`, `pull_request_review_comment` | `docs/adr/0004-github-app-read-only.md` | Read |
| 0.2 | Revise `migrations/001_initial_schema.sql` as in the spec's data model table. Add a `replace_repo_state(repo_id, payload jsonb)` function (security definer, runs in one transaction) and the `webhook_deliveries` table | `migrations/001_initial_schema.sql` | AC-10 query in `SETUP.md` |
| 0.3 | `SETUP.md` click-by-click: create the Supabase project, apply `001`, copy the URL and service-role key into Vercel; register the GitHub App (permissions, events, webhook URL, secret), generate the private key, install it on `netskyf-cell/chain`; spike S-B check (App client ID and secret in Supabase's GitHub provider, then sign in once) | `SETUP.md`, `.env.example` | The owner follows it; results go in the PR |

**Owner action after merging Group 0:** do the setup in 0.3. Groups A and B are built and tested against fakes meanwhile; only Group C's demo moment needs the live setup.

## Group A — access and cache (PR 2)

| Step | Do | Files | Verified by |
|---|---|---|---|
| A1 | Test, then code: App JWT and installation token, cached until 5 minutes before expiry | `test/github-app.test.js`, `lib/github-app.js` | AC-9 (key and token never in output or logs) |
| A2 | Test, then code: HTTP cache. A fresh entry gives no request, a stale or marked one gets `If-None-Match`, and a `304` reuses the stored body | `test/http-cache.test.js`, `lib/store/http-cache.js` | AC-4 |
| A3 | Test, then code: the connector reads through an optional cache (default: none, so S0 to S2 behaviour is unchanged) | `test/github.test.js`, `lib/connectors/github.js` | Existing tests unchanged, plus a cache case |
| A4 | Test, then code: Supabase store (PostgREST through `fetch`) and an in-memory store with the same interface | `test/store.test.js`, `lib/store/supabase.js`, `lib/store/memory.js` | Request shapes; the service-role key only in headers |

## Group B — sync, checks, webhooks, state (PR 3)

| Step | Do | Files | Verified by |
|---|---|---|---|
| B1 | Test, then code: the connector reads check runs and the combined status for open artifact PRs' head commits; `health()` adds "has failing checks" after changes requested | `test/state.test.js`, `lib/connectors/github.js`, `lib/reconcile/state.js` | AC-7, AC-6 |
| B2 | Test, then code: `refresh(repo)`, which runs the connector, then reconcile, then stores the snapshot observation and the derived rows (keeping 20 snapshots) | `test/sync.test.js`, `lib/sync.js` | AC-5 (at most 12 calls after a merge on recorded data), AC-6 |
| B3 | Record webhook payloads (from GitHub's documented examples, trimmed) | `fixtures/webhooks/*.json` | Read by B4 |
| B4 | Test, then code: `/api/webhooks/github`. It reads the raw body, verifies the signature, deduplicates deliveries, drops unknown repos, marks cache keys per the spec's table, then refreshes | `test/webhook.test.js`, `api/webhooks/github.js` | AC-1, AC-2, AC-3 |
| B5 | Test, then code: `/api/state`, which serves installed public repos (refreshing data older than 5 min within a time budget) and gives the same 404 for private and unknown ones | `test/state-api.test.js`, `api/state.js` | AC-8 |

## Group C — the board and the demo moment (PR 4)

| Step | Do | Files | Verified by |
|---|---|---|---|
| C1 | The board loads from `/api/state` when the repo is installed (falls back to `/api/demo`), polls every 30 s while visible, and shows "Updated hh:mm" | `public/js/api.js`, `public/js/views/board.js`, `public/js/views/demo.js` | AC-11, browser |
| C2 | Docs: `CLAUDE.md` current sprint, `docs/architecture.md` data flow, `SETUP.md` webhook troubleshooting | docs | Read |
| C3 | Demo moment, live: merge a PR on Chain's repository and watch the board update within a minute | none | AC-12, recorded in the PR with timestamps |

The last PR carries `Plan complete: yes`.

## For every pull request

- `npm test` green, `architecture-guard` run, **Divergences from plan** and **Verification** filled with evidence.
- No migration applied and no deploy by Claude: the owner applies `001` and deploys (CLAUDE.md working method 4).
- No secret in code, fixtures or logs. Recorded payloads are scanned for personal data before commit.

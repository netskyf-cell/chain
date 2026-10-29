---
slug: s1b-sync
capability: flow-visibility
produced_with: claude-code
---
# Spec: S1b — Persistence and sync

Derived from [`intent.md`](intent.md). Feature from the umbrella spec: **F-05** (webhook sync with cached fallback), plus the checks part of the `blocked` health rule (spec §6). Builds on ADR-0004 (read-only App), ADR-0005 (pure reconcile), ADR-0009 (Supabase, Vercel) and ADR-0014 (REST with ETags, proposed in PR #29).

## Decisions on the intent's open questions

These follow the intent's proposals. Change any of them in review of this PR.

| # | Question | Decision |
|---|---|---|
| 1 | The existing migration | Revise `migrations/001_initial_schema.sql` before its first application (it has never been applied). Changes listed below. |
| 2 | Where reconcile runs | In the function that handles the refresh, over the repository's full set of facts, right after the connector returns |
| 3 | Required checks | Any failing check run or commit status on an open artifact PR's head commit counts as failing. "Required" is not claimed. |
| 4 | Live updates | The page polls Chain's API every 30 seconds while visible. No Supabase Realtime. |
| 5 | Owner setup | Plan step 1 is the owner's setup (Supabase project, GitHub App) with `SETUP.md` instructions, plus the spike S-B sign-in check |

## How it works

```
GitHub ──webhook──▶ api/webhooks/github.js   verify signature on raw body; drop unknown repos
                         │                    record which resources the event changed
                         ▼
                    lib/sync.js               refresh(repo): connector (conditional requests) → reconcile → store
                         │
     lib/connectors/github.js  (+ lib/github-app.js: App JWT → installation token)
     lib/store/http-cache.js   ETag cache in sync_cache; event-invalidated keys
     lib/store/supabase.js     PostgREST calls with the service-role key (api/ only)
     lib/reconcile/*           unchanged: pure (ADR-0005)
                         ▼
                    Supabase: facts snapshot, derived rows, observations log
                         ▲
public/ ──every 30 s──▶ api/state.js         serves the stored model for public repos; refreshes if older than 5 min
```

### Refresh without re-reading everything (F-05, ADR-0014)

The connector reads through an **HTTP cache**:
- **Fresh entry:** answered from the stored body, with no request.
- **Stale entry:** re-checked with `If-None-Match`. A `304` reuses the stored body, and GitHub does not count it.
- **No entry:** fetched normally.

An entry is fresh when it was checked less than 5 minutes ago and no webhook has marked it changed since.

| Webhook event | Marks as changed |
|---|---|
| `pull_request` (any action) | that PR's detail, files, reviews and comments, plus the open and closed PR lists |
| `pull_request_review`, `pull_request_review_comment` | that PR's reviews or comments |
| `push` to the default branch | the head commit, the tree, the files the push changed, and the histories of changed artifact paths |
| `check_run`, `check_suite`, `status` | the checks of that head commit |
| `installation`, `installation_repositories` | the installation's repository list (repositories added or removed) |

After marking, the handler runs `refresh(repo)`. With most entries fresh, a merge costs a handful of calls.

### Facts, derived rows, audit log

- **Facts:** each refresh stores the connector output it used (the scan, the PR facts and the history) as one `observations` row, kind `snapshot`. This keeps the facts behind every state, with no file bodies, prompts or transcripts. Only the last 20 snapshots per repository are kept.
- **Derived rows:** each refresh replaces that repository's rows in `features`, `artifacts`, `pull_requests`, `review_findings` and `signals`, in one transaction (a Postgres function called through PostgREST). These rows exist for S3's portfolio and for queries. They are never edited by hand and never written by a client.
- **The response** of `api/state` is the same model shape as `api/demo`, so the views do not change.

### Checks state

- **Read:** for each open artifact PR, read `commits/:head_sha/check-runs` and `commits/:head_sha/status` (cached like the rest).
- **Health rule:** S1a's `blocked` rule gains a third reason, "PR #n has failing checks (name, …)". It sits after "changes requested" and before "inactive" (spec §6).
- **Permissions:** this needs two more **read-only** repository permissions on the App: **Checks: read** and **Commit statuses: read**. ADR-0004 is amended in this PR's plan, before any code.

### What is served, to whom (security)

In S1b nobody signs in (S3). So:
- **Public repositories:** `api/state?repo=owner/name` serves only repositories that are both installed **and** public on GitHub (`private: false`, stored as `repos.is_public`).
- **Private repositories:** they can be installed, refreshed and stored, but are **not served** until S3 adds sign-in. The response is the same 404 as for an unknown repository, so it does not reveal that they exist.
- **Demo mode** (`api/demo`) stays for public repositories that are not installed. It may use the HTTP cache.

## Data model changes (revising `001` before first application)

| Table | Change | Why |
|---|---|---|
| `repos` | add `gh_repo_id bigint unique`, `refreshed_at timestamptz` | match webhooks by id (repositories can be renamed); serve "last refreshed" |
| `features` | lifecycle check gains `no intent`; health values `on_track` → `on track` to match `reconcile()` | the model's values since S1a |
| `artifacts` | drop state `bypassed` (it is the `gate_bypassed` signal since S2) | one source of truth |
| `pull_requests` | add `role` (`artifact`, `build`), `plan_complete boolean`, `light_reason text`, `draft boolean`, `head_sha text`; `checks_state` values `passing`, `failing`, `none` | S1a and S2 facts, plus checks |
| `review_findings` | severity check: `block`, `important`, `nit` | Block added in S2 |
| `signals` | add `rule text`, `message text`, `evidence_type text`, `evidence_ref text`, `evidence_at timestamptz` | S2 signal shape (AC-5 of S2) |
| `sync_cache` | add `checked_at timestamptz`, `changed boolean default false` | freshness and webhook marking |
| `webhook_deliveries` (new) | `delivery_id text primary key`, `event text`, `received_at`; keep 7 days | idempotency: GitHub can redeliver |

All tables keep `created_at`, `updated_at`, and RLS on with default deny. Every write goes through `api/` with the service-role key. The new table has no read policy.

## Routes and files

| Path | Kind | Notes |
|---|---|---|
| `api/webhooks/github.js` | new function | POST only; 401 on a bad signature; 202 after recording; idempotent on `X-GitHub-Delivery` |
| `api/state.js` | new function | GET `?repo=owner/name`; rate-limited like `api/demo`; 404 for unknown or private |
| `lib/github-app.js` | new | App JWT (RS256 with `node:crypto`, no new dependency), installation token cached until 5 minutes before expiry |
| `lib/store/http-cache.js`, `lib/store/supabase.js` | new | Supabase through `fetch` to PostgREST, no client library |
| `lib/sync.js` | new | `refresh(repo, { fetch, store, now })`: connector, reconcile, store |
| `public/js/views/board.js` | changed | polls every 30 s while the tab is visible; shows "Updated hh:mm" |
| `migrations/001_initial_schema.sql` | revised | as above; the owner applies it |

No new view (ADR-0009 limit unchanged). `/#/` routes unchanged.

## Acceptance criteria

| ID | Criterion | Check |
|---|---|---|
| AC-1 | A webhook with a wrong or missing signature gets 401 and changes nothing; a valid one gets 202 | T (recorded payloads, computed signatures) |
| AC-2 | The same `X-GitHub-Delivery` twice is processed once | T |
| AC-3 | Events for repositories not in `repos` are dropped (202, no refresh) | T |
| AC-4 | The HTTP cache answers a fresh entry without a request, re-checks a stale or marked entry with `If-None-Match`, and reuses the body on `304` | T (fake fetch counting calls) |
| AC-5 | After a `pull_request` closed-and-merged event, a refresh makes at most 12 GitHub calls on Chain's recorded repository, and the merged PR is `merged` in the stored model | T |
| AC-6 | `reconcile()` output from stored facts equals the on-demand output for the same facts (S1a and S2 tests still pass unchanged) | T |
| AC-7 | `blocked` with "has failing checks" when a check run on an open artifact PR's head commit concluded `failure`, `timed_out` or `cancelled`, or a commit status is `failure` or `error`; ordered after changes requested and before inactivity | T |
| AC-8 | `api/state` serves installed public repositories; returns 404 for private or unknown ones, with the same body | T |
| AC-9 | An installation token is minted from the App JWT and reused until 5 minutes before it expires; the private key and tokens never appear in a response or a log line | T |
| AC-10 | The revised migration applies cleanly on an empty Supabase project, and every table has RLS on, `created_at` and `updated_at` | Owner applies; checked with a query listed in the plan |
| AC-11 | The board refreshes every 30 s while visible, stops while hidden, and shows when the data was last refreshed | B |
| AC-12 | **Demo moment:** merge a PR on Chain's own repository; within a minute the board shows the new state without a reload | B (live, after deploy) |

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Vercel functions get a parsed body; the signature needs the raw bytes | Valid webhooks rejected | Read the raw stream in the handler; contract test with a recorded payload; checked live in the demo moment |
| Function time limit (10 s on the Hobby plan) | A cold first scan of about 60 serial calls may not finish | The first scan runs from `api/state` with a time budget and returns what it has, marked `partial`; the next request continues from the cache |
| Webhooks lost or delayed | Stale board | 5-minute freshness: a page load re-checks stale entries (F-05 fallback) |
| Spike S-B fails hands-on | S3 sign-in needs a separate OAuth app | Does not block S1b; recorded in ADR-0004 |
| Snapshots grow | Storage | Keep the last 20 per repository |

## ADR impact

| ADR | How this spec complies |
|---|---|
| 0001 | Git stays the source; the database is a cache plus an audit trail |
| 0003 | Status is derived on each refresh; no status is written to the repository |
| 0004 | Read-only App. **Amendment needed:** add Checks: read and Commit statuses: read (both read-only) |
| 0005 | The connector observes; the cache sits under it; `reconcile` is unchanged and pure |
| 0009 | Supabase and Vercel, no new view, no client library (PostgREST through `fetch`) |
| 0014 | REST, ETags and webhooks, exactly as proposed |

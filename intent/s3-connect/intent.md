---
slug: s3-connect
capability: portfolio-vision
produced_with: claude-code
---
# S3 — Connect: sign in, connect your own repositories, see them together

## Problem

Today Chain only reads **public** repositories, one at a time, through demo mode. That is enough to show the idea, not to use it:

- A team's real work lives in **private** repositories. Chain cannot see them.
- A product leader looks after **several** products. They must paste each repository by hand, and nothing shows them side by side.
- Nobody signs in, so Chain cannot know whose repositories to show or keep them apart.
- Settings (`chain.yml` paths, the stale threshold, review passes, light-path thresholds) are read but never shown, so a team cannot see why Chain judged what it judged.

The demo moment for this slice (spec §4): **connect a private repository and see its chain.**

## Proposed outcome

A person can:

1. **Sign in with GitHub** (F-01). Chain shows only the repositories they connected.
2. **Install the Chain GitHub App on chosen repositories** (F-02). Permissions are read-only, and a repository can be removed at any time from GitHub.
3. **See a portfolio** (F-30) at `/#/portfolio`: one row per connected repository, with capability counts, the health mix (on track, drift, blocked) and the waiting count. Each row opens that repository's board.
4. **See the settings Chain uses** (F-61) at `/#/settings`: connected repositories, plus the effective `chain.yml` values with "default" shown where a value is absent.

How sign-in works follows spike S-B (ADR-0004): **one GitHub App** both signs the person in and reads their repositories. The GitHub user token is used at sign-in only, to list the installations that person can reach. Repository reads use short-lived installation tokens. Demo mode for public repositories stays as it is, with no sign-in.

## Depends on

**S1b (persistence and sync)** comes first. It brings the Supabase database, the registered GitHub App and installation tokens. S3 adds sign-in, the user-to-installation link and two views on top. The S3 spec waits for S1b's plan, so the two do not design the same tables twice.

## Non-goals

- No writes to GitHub or a PM tool. The App stays read-only (ADR-0004, ADR-0007).
- No teams, roles or sharing a read-only portfolio link (F-32, F-33, later).
- No cross-product rollups of drift or waiting queues (F-31, release 1.1).
- No editing `chain.yml` from Chain. Settings are shown, never written: the repository is the system of record (ADR-0001).
- No storing GitHub user tokens, transcripts or repository content beyond the cache S1b defines.
- No other sign-in providers.

## Open questions

1. **Hands-on check of spike S-B.** The desk result says one App can back Supabase sign-in, given the account permission "Email addresses: read". Proposed: the first plan step registers a test App and confirms it in 30 minutes. If it fails, a separate sign-in-only OAuth app with no repository scope.
2. **Who sees a repository.** Proposed: a signed-in person sees exactly the installations their GitHub token can reach, re-checked at each sign-in. No Chain-side sharing in 1.0.
3. **Portfolio cost.** Each row needs a scan. Proposed: read from S1b's cache. A row older than 5 minutes refreshes in the background, and the page says when each row was last read.
4. **Organisation approvals.** When an organisation admin must approve the install, the requester sees nothing until approval. Proposed: settings show "waiting for your organisation's approval" when no installation is visible yet.

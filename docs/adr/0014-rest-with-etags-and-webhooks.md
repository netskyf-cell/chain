# ADR-0014: Read GitHub through REST with conditional requests, driven by webhooks

- **Status:** proposed
- **Date:** 2026-10-29
- **Deciders:** Product owner
- **Related:** spike S-C (architecture §14), ADR-0004, ADR-0005, slice S1b, spec F-05

## Context

Spike S-C asked: should Chain read pull requests, reviews and files through REST, or batch them through GraphQL?

Facts:
- **Calls per scan today.** A full on-demand scan (S2) makes about 4 + 3 × PRs + artifact histories + commit lookups REST calls. That is about 60 for Chain's own repository, capped at about 270.
- **Free re-checks on REST.** A REST request with `If-None-Match` that returns `304 Not Modified` does not count against the primary rate limit. GitHub recommends webhooks over polling, and serial over concurrent requests.
- **GraphQL limits.** GraphQL can fetch PRs with files, reviews and review threads in one query, and `Commit.history(path:, since:)` replaces the per-file commit calls. But it has no conditional requests. It is costed in points (5,000 per hour per installation, rising to 12,500). Each connection is capped at 100 items, and a query that runs over 10 seconds fails and still costs points.
- **What S1b changes.** Webhooks deliver one event about one PR or one push. Keeping state fresh means reading one PR (files, reviews, comments) or one artifact history at a time, not a full scan.
- **What already exists.** The connector, its call caps and its recorded test responses are REST (S0–S2).

## Decision

We will keep **REST** as Chain's only GitHub interface. We will add **conditional requests** (ETag, stored in `sync_cache`). After the first scan of a repository, **webhook events** drive targeted re-reads of the PR or path they name. A page load re-scans only data older than 5 minutes (F-05), and unchanged resources then return 304.

## Consequences

- Easier: one connector, the existing recorded tests and caps stay. Most refreshes cost one or a few calls, and unchanged data costs nothing.
- Harder: the first scan of a large, busy repository costs up to about 270 calls. That is well within 5,000 per hour per installation, but the cost is real for repositories with hundreds of open PRs.
- Owed: `sync_cache` stores ETags per URL. The connector sends `If-None-Match`, and a 304 returns the cached body. Requests stay serial.
- **Revisit when** a connected repository regularly hits the S2 caps ("history partial"), or the first scan takes over 30 seconds. Then GraphQL for the first scan only is the candidate.

## Alternatives considered

| Option | Why not |
|---|---|
| GraphQL for everything | No free 304 re-checks. A second connector shape to test. Webhook-driven refreshes are small, so batching saves little |
| GraphQL for the first scan, REST afterwards | Two code paths for the same facts. Deferred until the revisit trigger above |
| Polling without webhooks | Wastes rate limit; GitHub advises against it |

## Evidence

- [GitHub: best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api): 304 responses do not count against the primary limit; webhooks over polling; serial requests.
- [GitHub: rate limits and query limits for the GraphQL API](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api): point costs, installation limits, 100 items per connection, 10-second timeout.
- [GitHub GraphQL reference: commits](https://docs.github.com/en/graphql/reference/commits): `history(path:, since:)` and `associatedPullRequests`.
- Call counts measured in S2 (`SETUP.md`, PR #21).

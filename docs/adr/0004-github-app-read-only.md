# ADR-0004: Access GitHub through a read-only GitHub App

- **Status:** accepted (spike S-B open)
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** spec §9, architecture §8. **Supersedes** the personal-access-token decision of 2026-08-31 in the first scaffold.

## Context

The first scaffold planned a personal access token (PAT) for v1, on the assumption of a single builder. The scope has changed: people connect their own repositories, the repository is a public showcase, and teams and organisations follow. A PAT is tied to one person, carries that person's reach, and cannot be limited per repository by the person who installs it. It does not scale to other people's repositories.

A GitHub App can be installed on selected repositories, requests only the permissions it declares, issues short-lived installation tokens, and receives webhooks.

## Decision

We will use a GitHub App with read-only repository permissions: **Contents: read, Pull requests: read, Metadata: read**. Installation tokens are minted server-side. Webhook events: push, pull request, pull request review.

Demo mode for public repositories has no installation, so it uses a server-held, read-only token that can read public data only.

## Consequences

- A user chooses exactly which repositories Chain sees, and can remove access at any time.
- Webhooks keep state fresh without polling, which also protects rate limits.
- More setup than a PAT: app registration, private key handling, webhook endpoint.
- Branch-protection details need higher permissions. The readiness check treats them as optional (spec open question 6).
- Open spike S-B: whether the app's user authorisation can back Supabase sign-in, or a separate OAuth app is needed.

## Alternatives considered

| Option | Why not |
|---|---|
| Personal access token | One person's reach, no per-repo scoping, no webhooks, does not fit other people's repos |
| OAuth app with repo scope | Broad, all-or-nothing repository scope; no installation model |
| Read the repo through user-uploaded exports | Not live; defeats the purpose |

## Evidence

GitHub documentation on GitHub Apps, fine-grained permissions and installation access tokens.

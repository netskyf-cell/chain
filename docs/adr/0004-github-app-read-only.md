# ADR-0004: Access GitHub through a read-only GitHub App

- **Status:** accepted (spike S-B: desk result 2026-10-29, hands-on check in slice S3)
- **Date:** 2026-10-01
- **Deciders:** Product owner
- **Related:** spec §9, architecture §8. **Supersedes** the personal-access-token decision of 2026-08-31 in the first scaffold.

## Context

The first scaffold planned a personal access token (PAT) for v1, on the assumption of a single builder. The scope has changed: people connect their own repositories, the repository is a public showcase, and teams and organisations follow. A PAT is tied to one person, carries that person's reach, and cannot be limited per repository by the person who installs it. It does not scale to other people's repositories.

A GitHub App can be installed on selected repositories, requests only the permissions it declares, issues short-lived installation tokens, and receives webhooks.

## Decision

We will use a GitHub App with read-only repository permissions: **Contents: read, Pull requests: read, Metadata: read**, and since S1b **Checks: read, Commit statuses: read** (amendment below). Account permission **Email addresses: read**, only so the same App can sign users in (spike S-B, below). Installation tokens are minted server-side. Webhook events: push, pull request, pull request review, and since S1b pull request review comment, check run, check suite and status. Installation and installation-repositories events are always sent to an App.

Demo mode for public repositories has no installation, so it uses a server-held, read-only token that can read public data only.

## Consequences

- A user chooses exactly which repositories Chain sees, and can remove access at any time.
- Webhooks keep state fresh without polling, which also protects rate limits.
- More setup than a PAT: app registration, private key handling, webhook endpoint.
- Branch-protection details need higher permissions. The readiness check treats them as optional (spec open question 6).
- Spike S-B (whether the app's user authorisation can back Supabase sign-in): see the result below.

## Alternatives considered

| Option | Why not |
|---|---|
| Personal access token | One person's reach, no per-repo scoping, no webhooks, does not fit other people's repos |
| OAuth app with repo scope | Broad, all-or-nothing repository scope; no installation model |
| Read the repo through user-uploaded exports | Not live; defeats the purpose |

## Evidence

GitHub documentation on GitHub Apps, fine-grained permissions and installation access tokens.

## Spike result: S-B (desk research, 2026-10-29)

**Question.** Can the GitHub App's user authorisation back Supabase sign-in, or is a separate OAuth app needed?

**Answer (likely yes, one app).** Configure Supabase's GitHub provider with the **GitHub App's** client ID and client secret, and set the App's callback URL to the Supabase callback. The steps fit together as follows:

| Finding | Source |
|---|---|
| A GitHub App signs users in with the same web flow as an OAuth app: `github.com/login/oauth/authorize`, then `login/oauth/access_token`, with the App's `client_id` and `client_secret`. | [GitHub: generating a user access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app) |
| For a GitHub App, `scope` does not grant permissions ("No other scopes are supported"); the App's registered permissions do. The user token has only what **both** the user and the App can reach. | same |
| User tokens expire after 8 hours, and refresh tokens last 6 months. Sign-in fails with `unverified_user_email` if the user's primary email is not verified. | same |
| Supabase's GitHub provider asks only for a client ID, a client secret and its callback URL `https://<project-ref>.supabase.co/auth/v1/callback`. Its docs describe an OAuth app, but nothing in them depends on that. | [Supabase: Sign in with GitHub](https://supabase.com/docs/guides/auth/social-sign-in/auth-github.md) |
| Reading the user's email needs the GitHub App **account** permission "Email addresses: read". Without it, sign-in through a GitHub App is reported to fail with `access_denied`. | [GitHub REST: emails](https://docs.github.com/en/rest/users/emails), [community report](https://www.answeroverflow.com/m/1395244737648394270) |
| The installation callback cannot reliably say **who** asked for an installation when an organisation admin approves it later: `state` is often missing. | [GitHub community discussion 42351](https://github.com/orgs/community/discussions/42351) |
| Supabase's session `access_token` is for Supabase. The GitHub token is `provider_token`. | [supabase/auth#1418](https://github.com/supabase/auth/issues/1418) |

**Consequences for S3.**
- **One GitHub App, two jobs.** It signs users in (user token) and reads repositories (installation tokens). There is no separate OAuth app.
- **One added permission.** The App gains the account permission **Email addresses: read**. It is not a repository permission, and the App stays read-only.
- **Linking users to installations.** Chain uses the user's token at sign-in to list the installations that user can access. It does not trust the installation callback, which avoids the organisation-approval gap.
- **What is kept.** The user token (`provider_token`) is used at sign-in and then discarded. Repository reads keep using short-lived installation tokens minted server-side.

**Not verified here.** Nothing was run. The first step of the S3 plan is a 30-minute hands-on check: register a test App, set it as the Supabase GitHub provider, sign in, and confirm email and `provider_token` arrive. If it fails, the fallback is a separate OAuth app that signs users in, with scopes `read:user user:email` and **no** repository scope, while the GitHub App keeps all repository access.

## Amendment: S1b (2026-10-29)

The `blocked` health rule in spec §6 includes "failing required checks". S1a skipped it. S1b reads it, which needs two more **read-only** repository permissions:

| Permission | Why | Endpoints |
|---|---|---|
| Checks: read | check runs on an open artifact PR's head commit | `GET commits/:sha/check-runs` |
| Commit statuses: read | older CI that reports statuses, not checks | `GET commits/:sha/status` |

The App also subscribes to `pull_request_review_comment`, `check_run`, `check_suite` and `status`, so those changes refresh Chain within a minute (F-05).

Nothing here writes. Chain still creates no check runs, statuses or comments. "Required" is not claimed, because reading branch protection needs Administration access (spec open question 6). Any failing check counts. Source: [intent/s1b-sync/spec.md](../../intent/s1b-sync/spec.md).

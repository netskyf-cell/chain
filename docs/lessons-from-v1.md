# Lessons from v1

The first prototype lives in the repository `chain-v1` (archived). It was a hosted board on Vercel and Supabase, reading Chain's own GitHub repository through a read-only GitHub App and webhooks. It ran from 2026-08 to 2026-11.

## What v1 proved

- Deterministic drift rules work on real history: rework of intents and specs, revised plans, declared divergences, tagged review findings, changes outside a pull request.
- Status can be derived from pull request state, never written in a file.
- The `[pass] Severity: text` review-finding format is easy for agents to write and for rules to read.
- A product owner can read the board without opening a diff.

## Why v1 is not continued

| Finding | Consequence |
|---|---|
| The first user's decisions live in Azure DevOps and Confluence, not in repository files | The rules must read roles, not one folder layout |
| Teams use different trackers, code hosts and words | Chain must learn each team's setup instead of imposing one |
| An outside hosted service needs a security review before it may read enterprise repositories | Chain runs inside the team's own coding agent, with the user's access |
| About 1,300 of v1's lines were hosting plumbing: App auth, webhooks, sync, cache, database | That plumbing is replaced by the agents' own connectors |
| v1 checked links and process, not whether code meets its criteria | A compliance review agent is added; its findings are evidence the rules read |
| A manual setup step in a plan was skipped and the feature still counted as shipped | Steps done by hand need evidence too |

## Kept, to be ported with their tests

| v1 path | What it is | Becomes |
|---|---|---|
| `lib/reconcile/` | Health and drift signals, pure functions | The rules engine, reading the observations file |
| `lib/parse/findings.js` | Parser for `[pass] Severity:` review lines | Unchanged in role |
| `lib/parse/pr-body.js` | Reads `Feature:`, divergences, `Plan complete:` from PR bodies | Used by the collector's normalisation, or by rules |
| `lib/config.js` | `chain.yml` defaults | Extended with roles, sources and vocabulary |
| `public/css/`, board views | The board's look and tokens | The local board |
| `REVIEW.md` | Review passes and tag format | Kept, with an `Unverifiable` verdict added |

## Not kept

GitHub App authentication, webhooks, ETag cache, Supabase store and migrations, `api/` functions, demo token, sign-in. Two bugs found by the 2026-11-02 compliance spike live in this code and are not fixed.

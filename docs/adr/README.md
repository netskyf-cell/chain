# Architecture Decision Records

One short file per decision that is hard to reverse. A decision is written **before** the code that depends on it, and the pull request that merges it is the acceptance.

Statuses: `proposed` (needs a spike or a confirmation), `accepted`, `superseded by ADR-NNNN`.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-git-is-the-system-of-record.md) | Git is the system of record for intent, spec and plan | accepted |
| [0002](0002-artifact-chain-convention.md) | Adopt the folder-per-feature artifact chain convention | accepted |
| [0003](0003-status-derived-from-pr-state.md) | Status is derived from pull request state, never written in files | accepted |
| [0004](0004-github-app-read-only.md) | Access GitHub through a read-only GitHub App | accepted (spike S-B open) |
| [0005](0005-connector-seam-and-pure-reconcile.md) | Connectors observe, one pure function decides | accepted |
| [0006](0006-claude-code-sessions-via-hooks-metadata-only.md) | Coding-agent session data: metadata only, documented export first, hook as fallback | **proposed** (spikes S-A, S-H) |
| [0007](0007-link-dont-replace-pm-tools.md) | Link to PM tools by ID, do not replace them | accepted |
| [0008](0008-deterministic-drift-detection.md) | Drift detection is deterministic, with no AI inference in v1 | accepted |
| [0009](0009-vanilla-front-end-vercel-supabase.md) | Vanilla front end on Vercel and Supabase | accepted |
| [0010](0010-chain-is-built-with-its-own-chain.md) | Chain is built with its own chain | accepted |
| [0011](0011-light-path-for-small-changes.md) | A light path for small changes, with a size guard | accepted (thresholds unvalidated) |
| [0012](0012-read-other-spec-layouts.md) | Read other spec-driven layouts through format readers | **proposed** (spike S-F) |
| [0013](0013-agent-neutral.md) | Chain is neutral to the coding agent, its interface and its model | accepted (spike S-H open) |

New ADR: copy [`template.md`](template.md), take the next number, and use the `adr` skill (`.claude/skills/adr/`).

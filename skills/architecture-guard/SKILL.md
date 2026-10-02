---
name: architecture-guard
description: Check a planned or finished change against Chain's architecture rules and ADRs. Use before building a plan and before opening a pull request.
---

# Architecture guard

Check each item. Report violations with file and line, and the ADR they break.

- Connectors only observe and return normalised Observations; no rules inside them (ADR-0005).
- `reconcile` is pure: same input, same output; no network, no clock, no randomness (ADR-0005).
- No status stored in any file or column that a pull request could contradict (ADR-0003).
- No write to GitHub or to a PM tool (ADR-0004, ADR-0007).
- No AI model call (ADR-0008).
- No transcript or prompt content stored or sent (ADR-0006).
- Secrets and the Supabase service-role key only in `api/`, read from environment variables.
- Every new table has row-level security, `created_at`, `updated_at`, and a migration file.
- Internal links use `/#/route`.
- A new view beyond 8, or shared cross-view state, needs an ADR first (ADR-0009).

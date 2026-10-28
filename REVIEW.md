# Review guide

Claude reads this file when reviewing a pull request. Three passes, run separately.

## Tag format (machine-read by Chain)

Start each finding on its own line with the pass in brackets, then the severity:

```
[bugs] Important: null `repo.paths` crashes reconcile when chain.yml is absent (lib/reconcile/index.js:42)
[security] Important: service-role key read in client code (public/js/api.js:10)
[compliance] Nit: ADR index not updated
```

Severity is `Block`, `Important` or `Nit`. Chain counts findings by pass. Findings of a drift pass (`chain.yml` `review.drift_passes`, default `compliance`) at Important or Block raise a `compliance_finding` drift signal. Lines inside code blocks are ignored, so examples like the ones above never count.

## Passes

**bugs** — logic errors, unhandled empty states, wrong state derivation, non-deterministic `reconcile`.

**security** — secrets in code, tables without row-level security, service-role key outside `api/`, unvalidated input on any `api/` route, private data in logs, anything that writes to GitHub or a PM tool (not allowed in v1).

**compliance** — does the PR still serve the feature's chain? Check, in order:
- each acceptance criterion in `intent/<slug>/spec.md` this PR claims: met, or say which one is not (`AC-3 not met`)
- the intent's **Non-goals** in `intent/<slug>/intent.md`: the PR must not do any of them (cite the non-goal)
- the plan in `intent/<slug>/plan.md`: steps done as written, or listed under "Divergences from plan"

Also check:
- a hard-to-reverse decision without an ADR
- status stored in a file (ADR-0003)
- an internal link without `/#/`
- a connector that applies rules (connectors only observe, ADR-0005)
- an AI call (none in v1, ADR-0008)
- a plan deviation not listed under "Divergences from plan"
- a `Light change:` PR that is really a feature (new behaviour, a new route or table, a changed rule), or that exceeds 5 files or 150 lines

## Severity

- **Block** — must not merge as is: contradicts the intent (does a non-goal) or breaks a load-bearing ADR.
- **Important** — fix before merge.
- **Nit** — optional. Report at most 5 nits per pass.

Report a finding only when you can point to the line and say what breaks.

# Review guide

Claude reads this file when reviewing a pull request. Three passes, run separately.

## Tag format (machine-read by Chain)

Start each finding on its own line with the pass in brackets, then the severity:

```
[bugs] Important: null `repo.paths` crashes reconcile when chain.yml is absent (lib/reconcile/index.js:42)
[security] Important: service-role key read in client code (public/js/api.js:10)
[compliance] Nit: ADR index not updated
```

Chain counts these by pass. `[compliance]` findings at Important raise a drift signal.

## Passes

**bugs** — logic errors, unhandled empty states, wrong state derivation, non-deterministic `reconcile`.

**security** — secrets in code, tables without row-level security, service-role key outside `api/`, unvalidated input on any `api/` route, private data in logs, anything that writes to GitHub or a PM tool (not allowed in v1).

**compliance** — does the PR match `intent/<slug>/plan.md`? Also check:
- a hard-to-reverse decision without an ADR
- status stored in a file (ADR-0003)
- an internal link without `/#/`
- a connector that applies rules (connectors only observe, ADR-0005)
- an AI call (none in v1, ADR-0008)
- a plan deviation not listed under "Divergences from plan"

## Severity

- **Important** — fix before merge.
- **Nit** — optional. Report at most 5 nits per pass.

Report a finding only when you can point to the line and say what breaks.

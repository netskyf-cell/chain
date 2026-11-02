---
name: architecture-guard
description: Check a planned or finished change against Chain's decision records. Use before building a plan and before opening a pull request.
---

# Architecture guard

Check each item. Report violations with file and line, and the decision record they break.

- The rules engine makes no AI or network call, reads no clock except the `collectedAt` it is given, and gives the same output for the same observations file (ADR-0001).
- Agents that collect (setup, collector) never decide drift; only rules do (ADR-0001).
- The compliance review agent writes findings only in the `REVIEW.md` format (ADR-0001).
- No server, database, hosted endpoint or sign-in (ADR-0002).
- Rules read only the observations file and no source-specific field; a new source changes the collector, not the rules (ADR-0003).
- Any change to the observations format updates the schema, the example, the contract README and its version (ADR-0003).
- Chain's own code never writes to a tracker, wiki or code host.
- No secret, token, personal data, company name or internal URL in any file (public repository).
- No Status line in an intent, spec or plan.

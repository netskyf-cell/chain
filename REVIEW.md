# Review guide

Any reviewer, person or agent, reads this file when reviewing a pull request. Three passes, run separately. Chain's own compliance review agent uses the same format on the teams it serves.

## Tag format (machine-read by Chain)

Each finding on its own line: the pass in brackets, the verdict, then the text with file and line.

```
[bugs] Important: rule crashes when an item has no parent (lib/rules/stalled.js:18)
[security] Important: token read from a file inside the repository (agents/collector.md:40)
[compliance] Met: AC-1 CSV download works, covered by trips-export.test.ts
[compliance] Important: AC-2 not met: the export ignores the date range (src/trips/export.ts:22)
[compliance] Unverifiable: no acceptance criteria linked to this change
```

Verdicts:

- `Block`: must not merge as is.
- `Important`: fix before merge. On the compliance pass, a criterion not met.
- `Nit`: optional. At most 5 per pass.
- `Met`: compliance pass only, one per criterion that is met.
- `Unverifiable`: compliance pass only, when no criteria can be found.

Lines inside code blocks are ignored, so the examples above never count. Report a finding only when you can point to the line and say what breaks.

## Passes

**bugs:** logic errors, unhandled empty input, a rule that gives different answers for the same input.

**security:** secrets in files, anything that writes to a tracker, wiki or code host from Chain's own code, personal data or prompt content stored or logged, unvalidated input.

**compliance:** does the change deliver its decision? In order:

1. Find the decision: `intent/<slug>/` for Chain itself; for teams, where `chain.yml` says.
2. One verdict per acceptance criterion the change claims: `Met`, or `Important` with what is missing.
3. The intent's **Non-goals**: the change must not do any of them (`Block`, cite the non-goal).
4. The plan: steps done as written, or listed under "Divergences from plan".

Also check for: a hard-to-reverse decision without a decision record, a status written in a file, an AI call in the rules engine (ADR-0001), and a `Light change:` PR that is really a feature or exceeds 5 files or 150 lines.

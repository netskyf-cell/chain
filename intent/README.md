# intent/

One folder per feature. The folder is the artifact chain.

```
intent/<slug>/
  intent.md   why, outcome, non-goals
  spec.md     scope and testable acceptance criteria
  plan.md     ordered steps, written in Claude Code plan mode
```

## Rules

- Optional frontmatter: `slug`, `capability`, `produced_with` (`claude-ai`, `claude-code`, `claude-design`, `human`), `design` (reference), `links` (work-item IDs).
- **No status in files.** Chain derives it from pull request state: open PR = proposed, merged = accepted.
- Branch: `claude/intent-<slug>`. A person accepts by merging.
- Order: intent merged → spec merged → plan merged → build.

`intent/chain/` is the product-level intent and umbrella spec for Chain itself.

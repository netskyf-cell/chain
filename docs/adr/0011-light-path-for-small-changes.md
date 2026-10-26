# ADR-0011: A light path for small changes

- **Status:** accepted (thresholds are unvalidated defaults)
- **Date:** 2026-10-02
- **Deciders:** Product owner
- **Related:** spec F-17, F-27, §5.5–5.6, §7. Evidence: [landscape](../landscape.md)

## Context

The full chain (intent, spec, plan, pull request) fits a feature. It is too heavy for a typo, a dependency bump or a small bug. A review of spec-driven tools found that heavy output is tedious to review, and that one tool produced four user stories and sixteen acceptance criteria for a small bug ([landscape](../landscape.md)). A method that is skipped because it is too heavy would hide work from Chain, and Chain would show a false picture.

## Decision

Chain recognises two kinds of change:

1. **Feature**: travels the full chain. Linked by the rules in spec §5.5.
2. **Light change**: a pull request whose body has a non-empty line `Light change: <reason>`. It needs no `intent/` folder. It still needs a pull request and review.

A light change is listed on its repository and, if the PR also has a line `Capability: <slug>`, counted under that capability. It has no lifecycle and no health of its own.

A size guard keeps the light path honest. A light change that exceeds `light.max_files` files or `light.max_changed_lines` changed lines raises the signal `light_path_large` (severity warn). Defaults are **5 files and 150 lines**. They are starting values with no evidence behind them. They are tuned on Chain's own repository and stated as such.

Feature wins over light when both are present (spec §5.5, first match).

## Consequences

- Small work stays visible without ceremony.
- The light path could be used to dodge the chain. The size guard and the `[compliance]` review pass are the mitigation. Chain does not try to detect intent.
- Signals can attach to a pull request without a feature, so the data model allows a signal with a repository and a PR but no feature.
- The PR template asks for one of two lines, `Feature:` or `Light change:`.
- Counts of light changes are shown, never scored.

## Alternatives considered

| Option | Why not |
|---|---|
| One path for everything | Too heavy for small work; it gets skipped (landscape evidence) |
| Infer "small" from the diff alone, with no declaration | No stated intent; harder to explain than a declared line plus a guard |
| Ignore small changes | Chain would under-report work and could not show a full picture |

## Open

Thresholds are to be tuned. Revisit after slice S2 using Chain's own pull requests.

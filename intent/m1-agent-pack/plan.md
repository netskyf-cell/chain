---
slug: m1-agent-pack
spec: spec.md
produced_with: claude-code
---
# Plan: first milestone, the agent pack

Builds [`spec.md`](spec.md). Signals come from the [signal catalogue](../../docs/contract/signals.md). Five groups, one pull request each, in this order. Each group starts only after the one before it is merged.

Like building a house: foundations (contract), then plumbing (rules), then rooms people see (board), then the people who move in (agents), then the keys (install).

## Changes to the spec (accepted by merging this plan)

| # | Change | Why |
|---|---|---|
| P1 | Authorship is collected as raw evidence (PR author, branch, labels, commits with trailers, review authors). Rules classify person, agent, mixed or unknown. The collector no longer writes `authorKind`, `agent` or `byKind`. | Same reason as D2: classifying is judging (ADR-0001). Patterns live in `chain.yml`, so a new agent needs no code. |
| P2 | Board **facts** next to drift signals: started in, path across tools, where built, agent share, checked by. | Owner's direction, 2026-11-02: capture where intent starts and who builds. |
| P3 | Ninth rule, **Agent change, no person reviewed**: a merged change classified agent or mixed with no review by a person. | Intent principle 4: missing evidence is a finding. |

## Group A: contract 0.2

| Step | Files | Verified by |
|---|---|---|
| A1 | `docs/contract/observations.schema.json`: version `chain.observations/0.2`; add `change.body`, `change.repository`, `change.author`, `change.branch`, `change.labels`, `change.commits[]` (`sha`, `author`, `trailers`, `at`), `reviews[].author`, `reviews[].body`, `criteria[].idSource`, `sources[].connector`; remove `change.divergences`, `reviews[].findings`, `authorKind`, `agent`, `byKind` | `npm test` |
| A2 | `docs/contract/chain-yml.schema.json`: new; covers `team`, `vocabulary`, `sources`, `roles`, `rules`, `collect.since_days`, `authorship` patterns, state mapping | Test: `examples/chain.example.yml` validates |
| A3 | `examples/observations.example.json`, `examples/chain.example.yml`: rewritten to 0.2, one case per rule and per fact, including a mixed PR and a cloud-agent PR | `npm test` |
| A4 | `docs/contract/README.md` (fields, rules table with rule 9, facts table); `docs/adr/0003-*.md` (contract change noted) | Review |
| A5 | `scripts/validate-contract.js` → `lib/validate.js`, also checks `chain.yml` | `npm test` |

Covers: spec §3, AC-C7, P1.

## Group B: rules engine and CLI

| Step | Files | Verified by |
|---|---|---|
| B1 | `lib/parse/findings.js`, `lib/parse/pr-body.js`: ported from `chain-v1` with their tests; findings parser adds `Met` and `Unverifiable` | Ported tests pass, plus new cases (AC-E3) |
| B2 | `lib/authorship.js`: classifies commits, PRs and reviews from raw evidence and `chain.yml` patterns; derives cloud or local | Test per catalogue row |
| B3 | `lib/rules/<rule>.js`, one file per rule (9 rules); `lib/rules/index.js` runs them sorted | Test: each rule raised once and not raised once (AC-E1) |
| B4 | `lib/facts/`: started in, path, where built, agent share, checked by | Test on the example |
| B5 | `lib/rules/shared.js`: "not checked" when a needed source is unread; latest compliance review wins | AC-E4, AC-E5 tests |
| B6 | `bin/chain.js`: `validate`, `compare`, `rules`; `package.json` `bin` and `engines` (Node 20+) | AC-E2 (run twice, byte-identical), AC-C6 (`compare`), AC-I3 |
| B7 | Run the `architecture-guard` skill: no clock, network or AI call in `lib/rules` and `lib/facts` | Guard report in PR |

Covers: AC-E1 to AC-E7, AC-C6, AC-I3, P1, P3.

## Group C: board

| Step | Files | Verified by |
|---|---|---|
| C1 | `lib/board/css/`: tokens and styles from `chain-v1/public/css` | Check against v1 (AC-B6) |
| C2 | `lib/board/render.js`: verdicts and facts in, one HTML string out, data embedded, no external request | Test: no `http` outside source links (AC-B1) |
| C3 | Views in the intent's order: decisions and where each stands with its path across tools; no code / no decision; criteria not met with evidence; nobody checked; then facts (where built, agent share, checked by) | Check (AC-B2) |
| C4 | Team words only; unread sources and "not checked" at the top; each signal links to its source | Tests (AC-B3, AC-B4, AC-B5) |
| C5 | `chain board` writes `chain/board.html` | Test |

Covers: AC-B1 to AC-B6, P2.

## Group D: agents

Canonical instructions in `agents/`; `scripts/build-adapters.js` writes `adapters/copilot/` and `adapters/claude/`.

| Step | Files | Verified by |
|---|---|---|
| D1 | `agents/collector.md`: reads each source in `chain.yml` with read-only connectors, follows the signal catalogue row by row, copies text verbatim, writes `chain/observations.json`, runs `chain validate` | AC-C1 to AC-C8: two runs on a test ADO project and GitHub repository, `chain compare` exits 0 |
| D2 | `agents/compliance-review.md`: finds criteria through links, reads `git diff`, one verdict per criterion in `REVIEW.md` format, shows the comment, posts after confirmation | AC-R1 to AC-R5; AC-R6 re-run on the spike PR |
| D3 | `agents/setup.md`: checks each connector, discovers types and criteria fields, proposes roles and authorship patterns, writes `chain.yml`, runs `chain validate --config` | AC-S1 to AC-S5 |
| D4 | `scripts/build-adapters.js` and adapter test | AC-I2 |

Covers: AC-S*, AC-R*, AC-C*, AC-I2. Order: collector first, because the rules already wait for its file; review second; setup last, since it writes what the other two read and is easiest to shape once they work.

## Group E: install, guide, benchmark

| Step | Files | Verified by |
|---|---|---|
| E1 | `chain install --target copilot|claude` in `bin/chain.js` | Test in a temp folder (AC-I1) |
| E2 | `README.md`: install to board in under an hour, including connector checks | One person outside the project follows it (AC-I4) |
| E3 | `docs/benchmark.md`: method for 5 PRs, rating sheet, results | AC-X1, AC-X2 with the pilot team |
| E4 | Last PR body carries `Plan complete: yes` | Review |

## Rules for every group

- Branch `claude/intent-m1-agent-pack-<group>`; PR body has `Feature: m1-agent-pack` and `## Divergences from plan`.
- Before opening: `npm test`, examples valid, `architecture-guard` run.
- No company, team or internal names in any file, example or fixture.

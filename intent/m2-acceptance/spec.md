---
slug: m2-acceptance
intent: intent.md
produced_with: claude-code
---
# Spec: ready to accept

Derived from [`intent.md`](intent.md). Builds on the first milestone: contract 0.2, nine rules, facts, board, three agents.

Like a pre-delivery inspection on a truck line: each Feature gets a sheet with one line per criterion, ticked or not, and a clear "ready to ship" or "back to station 4, owner: X".

## Problem statement

Product owners accept Features at sprint review on trust or by hand, because nothing shows criterion by criterion whether the shipped code meets what was agreed. The board shows breaks but not the decision they affect or the next action, in vocabulary they must learn. Developers learn about missed criteria after the PR is open. The cost: broken Features accepted, rework found late, and a board people look at once.

## Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | A product owner decides "accept or not" per Feature from Chain alone | In the pilot, 3 of 3 product owners use the acceptance view at 2 consecutive sprint reviews |
| G2 | Gaps are found before the PR, not after the merge | At least 1 criterion gap fixed before the PR is opened in the pilot's first 2 sprints |
| G3 | The board is understood without training | 3 product owners shown the demo each name one action they would take |
| G4 | Findings stay trusted | Noise under 30% (the milestone 1 benchmark bar) |

## Non-goals

| Non-goal | Why |
|---|---|
| Accepting, rejecting or editing work items from Chain | Read-only principle; the product owner decides in their own tool |
| Any score or ranking of people, developers or teams | Turns a help into surveillance; the developer layer dies |
| A developer board | Developers live in the IDE and the PR; the pre-flight check is their surface |
| New drift rules | This milestone reorganises what the nine rules say; it adds none |
| Portfolio view across teams, leadership dashboard | Later; the sponsor is the product owner |

## User stories

**Product owner**

1. As a product owner preparing sprint review, I want each Feature marked ready to accept, not ready, or not checked, so that I know which ones I can accept without opening every PR.
2. As a product owner, I want each criterion of a Feature shown with its verdict and the PR that delivers it, so that I can see exactly what is missing.
3. As a product owner, I want every problem to say who acts next and what to do, so that I can assign it in the meeting instead of investigating.
4. As a product owner, I want problems in three plain groups (missing link, not met, not checked), so that I do not have to learn nine rule names.
5. As a product owner, I want a team's declared divergence shown as information, not as a problem, so that the board does not discourage honesty.
6. As a product owner, I want a Feature with no criteria written shown as "not checked: no criteria", so that I know the gap is in the decision, not the code.

**Developer**

7. As a developer, I want to check my branch against the story's criteria before opening a PR, so that I fix gaps while it is cheap.
8. As a developer, I want that check to stay private, so that I can use it without being graded.
9. As a developer, I want the check to suggest the PR lines Chain reads (the `AB#` link, a "Divergences from plan" section), so that my PR is linked right the first time.

## Requirements

### P0: must have

**R1. Acceptance status per Feature** (rules engine, deterministic)

For every item whose role is `spec` (the team's Feature), compute one status from the observations file:

| Status | When |
|---|---|
| **Ready to accept** | It has criteria; every criterion's latest verdict, across merged changes linked to it or to its plan items, is `Met`; no criterion changed after the merge that met it; every plan item under it is `done` with a merged change |
| **Not ready** | Any criterion's latest verdict is `Important` or `Block`; or a criterion changed after the merge that met it ("moved goalposts"); or a plan item is `done` with no merged change |
| **Not checked** | Otherwise: no criteria, criteria with no verdict, only `Unverifiable` verdicts, or plan items still open |

Each criterion also gets: its latest verdict (`met`, `not-met`, `none`), the change and review that gave it, and the evidence URL.

Acceptance criteria:
- [ ] Given a Feature whose 3 criteria each have a `Met` verdict from merged PRs and whose stories are all done with merged PRs, status is Ready to accept.
- [ ] Given one criterion with `Important` in the latest compliance review, status is Not ready, and that criterion shows `not-met` with the review URL.
- [ ] Given a later review that says `Met` for the same criterion, the latest wins and the criterion shows `met`.
- [ ] Given a criterion whose `changedAt` is after the merge that met it, status is Not ready.
- [ ] Given a Feature with no criteria, status is Not checked with the reason "no criteria written".
- [ ] Same input, byte-identical output (ADR-0001); no clock but `collectedAt`.
- [ ] On the demo team: "Monthly fuel report per vehicle" is Not checked (AC-3 has no verdict, one story still active); "Suggest the shortest daily route" and "Export trip history" are Not ready.

**R2. Next action and owner per problem** (rules engine)

Every signal carries `owner` (one of `product owner`, `author`, `reviewer`, `team`) and `action` (one sentence, team words filled in by the board). Fixed mapping:

| Rule | Owner | Action |
|---|---|---|
| Done without proof | product owner | Reopen the {plan} or link the {change} that delivered it |
| Change without a mandate | author | Link the {change} to its {plan}, or say why it has none |
| Out of order | product owner | Move the {plan} to its real state |
| Moved goalposts | product owner | Re-check {criterion} against the shipped code, or add a {plan} for the change |
| Stalled intent | product owner | Decide: continue, re-plan or close the {intent} |
| Criterion not met | author | Fix {criterion}, or agree a change to it with the product owner |
| Unverified | reviewer | Run the criteria review on the {change} |
| Agent change, no person reviewed | reviewer | Review the {change} before the {spec} is accepted |
| Declared divergence | product owner | Read what changed and accept or re-plan |

Acceptance criteria:
- [ ] Every signal in the verdicts file has a non-empty `owner` from the list and an `action`.
- [ ] The board shows owner and action on every problem, in the team's words, with no role name.

**R3. Three plain groups, divergence as information** (board)

| Group shown | Rules |
|---|---|
| Missing link | Done without proof, Change without a mandate, Out of order, Stalled intent |
| Not met | Criterion not met, Moved goalposts |
| Not checked | Unverified, Agent change, no person reviewed |
| Information (not a problem) | Declared divergence |

Acceptance criteria:
- [ ] Problems are listed under these three group names; the rule name appears only as secondary text.
- [ ] A declared divergence is shown in a neutral style, labelled "Declared change", and does not count as a break or make a Feature Not ready.

**R4. Acceptance view leads the board** (board)

- The page opens on the acceptance summary: "{n} of {m} {spec plural} ready to accept", then one row per Feature: status, criteria met out of total, next action count.
- Each Feature expands to its criteria list: criterion text, verdict, delivering PR, evidence link.
- The chain view stays below, per Epic, as the "why".

Acceptance criteria:
- [ ] The first heading of the page states how many Features are ready to accept.
- [ ] Every Feature in the file appears once with one of the three statuses, written in words, not colour alone.
- [ ] The "20 signals" style count is gone from the headline.

**R5. Calmer nodes** (board)

- A node shows at most one problem mark (the most serious: Not met, then Not checked, then Missing link) and "+N more".

Acceptance criteria:
- [ ] On the demo team, no node shows more than one mark plus a "+N more" label.

**R6. Developer pre-flight check** (review agent)

A second mode of `chain-compliance-review`, triggered by "pre-flight" or "check my branch":

- Reads the story or Feature named by the developer, or found from the branch name or recent commit messages.
- Reads the criteria through the team's connector, read-only.
- Compares with `git diff <default branch>...HEAD` and the files it touches.
- Prints one verdict per criterion in the `REVIEW.md` format, in the chat only.
- Suggests the PR description lines Chain reads: the link (`AB#123`), and a "Divergences from plan" section when the code differs from the plan.

Acceptance criteria:
- [ ] In pre-flight mode the agent calls no write tool and posts nothing, anywhere.
- [ ] It writes no file in the repository.
- [ ] Its output parses with `lib/parse/findings.js`: one verdict per criterion.
- [ ] When no story can be found, it asks the developer for the id instead of guessing.

### P1: nice to have

| # | Requirement | Acceptance |
|---|---|---|
| R7 | **Sprint filter**: show only Features in the current iteration, when the source has iterations. Needs `item.iteration` in contract 0.3 | Given items with iterations, `chain board --iteration <name>` shows only those Features |
| R8 | **Weekly digest**: `chain digest` prints 5 lines of markdown (Features ready, not ready with owners, unchecked PRs) to paste in a team channel | Output under 10 lines, team words, links to evidence |

### P2: future (design so it stays possible)

- Portfolio view across teams, from several observations files.
- A leadership view of agent-written code and its review coverage.
- Pre-flight run automatically by a hook before `git push`.

## Data touched

| Part | Change |
|---|---|
| `lib/acceptance.js` (new) | Per-spec status and per-criterion verdicts (R1) |
| `lib/rules/*.js`, `lib/rules/shared.js` | `owner` and `action` on every signal (R2) |
| `lib/engine.js` | Verdicts gain `acceptance`; version `chain.verdicts/0.2` |
| `lib/board/render.js`, `lib/board/css/board.css` | Acceptance view, groups, calmer nodes (R3–R5) |
| `agents/compliance-review.md`, adapters | Pre-flight mode (R6) |
| `examples/demo/` | One Feature made Ready to accept, so all three statuses show |
| `docs/contract/README.md` | Verdicts 0.2: acceptance and owners. The observations contract stays 0.2 (R7 would need 0.3) |

## Success metrics

| Type | Metric | Target | How measured |
|---|---|---|---|
| Leading | Product owners who use the acceptance view at sprint review | 3 of 3 pilot POs, 2 sprints running | Ask at each review |
| Leading | PRs with a pre-flight run before opening | 50% of pilot developers' PRs in sprint 2 | Developers' own count; nothing is logged |
| Leading | Gaps fixed before the PR | At least 1 in 2 sprints | Developer report |
| Lagging | "Not met" verdicts found after merge | Down 50% after 4 sprints, against the first collection | Board, criteria not met on merged PRs |
| Lagging | Noise in findings | Under 30% | Benchmark sheet, `docs/benchmark.md` |

## Open questions

| Question | Who answers | Blocking? |
|---|---|---|
| Does the product owner accept per Feature or per story in this team? If per story, R1 moves to the `plan` role | Product owner | Yes, before R1 |
| Must "Ready to accept" also require a review by a person? | Product owner | No; default: not required, shown beside the status |
| Are iterations readable through the Azure DevOps connector at the team's setup (for R7)? | Engineering | No (P1) |
| Should developers' pre-flight count be shared with the team, or stay with each developer? Default: stays with them | Product owner, developers | No |

## Timeline and phasing

Phase 1 (one sprint): R1, R2, R3, R4, R5 on the demo team, so the product owner demo shows the acceptance view. Phase 2 (in the pilot's first sprint): R6, used by 2 developers. P1 items after the pilot's first sprint review.

## Risks

| Risk | Mitigation |
|---|---|
| "Ready to accept" is read as Chain approving the Feature | Label it "Ready to accept: every criterion met, by the evidence collected". The product owner still accepts in their own tool |
| Criteria written without ids make verdicts hard to match | The setup agent already suggests `AC-n` numbering; Not checked shows "criteria without ids" when matching fails |
| Developers see pre-flight as a check on them | Private by design (R6), no person names on the board (non-goal) |

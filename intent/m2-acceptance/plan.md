---
slug: m2-acceptance
spec: spec.md
produced_with: claude-code
---
# Plan: ready to accept

Builds [`spec.md`](spec.md). Written to be followed step by step by a coding agent (GitHub Copilot in VS Code, or Claude Code). Three groups, one pull request each, in order. Each group starts after the one before it is merged.

Like building a house: the inspection logic first (rules), then the room people see (board), then the tool developers carry (pre-flight).

## Before you start (every group)

1. Read `AGENTS.md`, then this plan and `spec.md`.
2. `npm install`, then `npm test`: all tests must pass before you change anything.
3. Branch: `copilot/m2-acceptance-<group letter>` (or `claude/intent-m2-acceptance-<group letter>`).
4. One pull request per group. PR body: `Feature: m2-acceptance`, a `## Divergences from plan` section ("None." if none), and a `## Verification` section with the test count.
5. Never push to `main`. A person merges.

## Group A: acceptance status and next actions (rules engine)

| Step | Do | Files | Check |
|---|---|---|---|
| A1 | Write `acceptance(ctx)`: for each `spec` item, the per-criterion latest verdict, the Feature status, and the list of its stories (`plan` children) with their state, linked changes, own criteria and story status, exactly as the tables in spec R1. Stories with no Feature go in a separate list. Match findings to criteria by the `criterion` id the findings parser returns. Consider merged changes linked to the spec item or to any of its `plan` children. Latest review wins (reuse `latestCompliance`). Pure: no clock, no network | `lib/acceptance.js` (new) | Unit tests for each row of both R1 tables (Feature and story) and each R1 acceptance criterion |
| A2 | Add `owner` and `action` to every signal, from the mapping table in spec R2. Store `action` as a template with `{plan}`, `{change}`, `{spec}`, `{intent}`, `{criterion}` placeholders; the board fills them in | `lib/rules/*.js`, `lib/rules/shared.js` (extend `signal()`) | Test: every signal from the example and the demo has an `owner` in the allowed list and a non-empty `action` |
| A3 | Add `acceptance` to the engine output and bump `verdicts` to `chain.verdicts/0.2` | `lib/engine.js` | Existing tests updated for the new version; byte-identical output test still passes |
| A4 | Change the demo so one Feature is Ready to accept: in `examples/demo/observations.json`, add a `[compliance] Met: AC-3 ...` review on a merged PR for `ado:313` and set `ado:313` to done with that PR merged (keep dates before `collectedAt`). Then all three statuses show | `examples/demo/observations.json` | `npx chain validate examples/demo/observations.json` prints ok; a test asserts one Feature of each status on the demo |
| A5 | Document verdicts 0.2: `acceptance` shape, `owner`, `action` | `docs/contract/README.md` ("What the rules engine writes") | Review |

Done when: `npm test` passes, and the R1 and R2 acceptance criteria each have a test.

## Group B: the acceptance view (board)

| Step | Do | Files | Check |
|---|---|---|---|
| B1 | New top of the page: the headline "{n} of {m} {spec plural} ready to accept", then one row per Feature: status in words with an icon (✓ Ready to accept, ✕ Not ready, ? Not checked), criteria met out of total, number of next actions. Remove the signal count from the headline | `lib/board/render.js` | Test: first `<h1>` names the ready count; every spec item appears once with its status word |
| B2 | Each Feature row shows a story summary ("3 stories: 1 done and checked, 2 not ready") and expands (`<details>`, no script) to its criteria (id, text, verdict word, delivering PR, evidence link), then its stories (title, state, PRs, status in words, own criteria), then its next actions. Stories with no Feature get their own row | `lib/board/render.js` | Test: on the example, `ado:110` lists AC-1 met, AC-2 not met, AC-3 changed after merge, and stories 111 Done and checked, 112 Not ready, 113 Not ready |
| B3 | Every problem shows its owner and action in the team's words, under one of three group names (Missing link, Not met, Not checked). Rule names become secondary text | `lib/board/render.js` | Test: the three group names appear; no visible role name (reuse the AC-B3 vocabulary test) |
| B4 | Declared divergence: neutral style, label "Declared change", excluded from break counts and from the chain card's "N breaks" | `lib/board/render.js`, `lib/board/css/board.css` | Test: on the example, the Driver self-service chain no longer counts the divergence as a break |
| B5 | Nodes show at most one mark (Not met, then Not checked, then Missing link) plus "+N more" | `lib/board/render.js` | Test: no node on the demo has more than one `class="mark` plus one "+N more" |
| B6 | Keep the chain view below the acceptance view, heading "Why: each {group}, from decision to code" | `lib/board/render.js` | Existing chain tests still pass |
| B7 | Screenshot the demo board at 1280 px (light and dark) and 390 px; attach to the PR | — | 0 network requests (open from disk) |

Done when: `npm test` passes; the screenshots show the acceptance view first; `docs/demo.md` is updated to open on the acceptance view.

## Group C: developer pre-flight (review agent)

| Step | Do | Files | Check |
|---|---|---|---|
| C1 | Add a "Pre-flight mode" section to the review agent: triggered by "pre-flight" or "check my branch"; finds the story from the developer's words, the branch name or commit messages, else asks; reads criteria read-only; diffs `git diff <default branch>...HEAD`; prints verdicts in chat only; suggests the `AB#` link line and a "Divergences from plan" section | `agents/compliance-review.md` | Test: the section exists, says it posts nothing and writes no file, and its example output parses to one verdict per criterion |
| C2 | Regenerate adapters | `npm run build:adapters` | `adapters` test passes |
| C3 | README: a short "Before you open a pull request" section for developers | `README.md` | Test: section present with the trigger phrase |
| C4 | Manual: one developer runs pre-flight on a real branch in VS Code with Copilot | — | Record in the PR what it found; no comment posted, no file written (`git status` clean) |

Done when: `npm test` passes and C4 is recorded. Last PR body carries `Plan complete: yes`.

## Prompt to start each group in Copilot

> Read AGENTS.md, then intent/m2-acceptance/plan.md and spec.md. Build group A only. Follow the steps in order, run npm test after each step, and stop when group A's "Done when" is met. Then open one pull request as the plan says, listing any divergence from the plan.

Replace "group A" with B or C for the next groups.

# Implementation guide

How to build Chain, step by step. Read it once, then use sections 3 to 6 as a checklist.

The method is the product's own: nothing is built before its intent, spec and plan are merged ([ADR-0010](adr/0010-chain-is-built-with-its-own-chain.md)).

## 1. How information flows

Think of a train station. GitHub holds the timetable files. Chain is the departure board: it reads the timetable and shows what is on time, what is late and what waits for a decision. It never drives a train.

```
Claude Design / Claude.ai / Claude Code
        │ write files, open pull requests
        ▼
GitHub  ── intent.md, spec.md, plan.md, PRs, review findings
        │ read-only (GitHub App, webhooks)
        ▼
Connector  → "observations"   (the clerk who photocopies, never judges)
        ▼
reconcile()  → state + signals (the accountant: fixed rules, same input, same answer)
        ▼
Supabase tables  (the ledger: derived views, never the truth)
        ▼
Web app  (the board people read)
```

| Piece | Role | What you need to know |
|---|---|---|
| GitHub | The truth: files and pull requests | A branch is a draft copy. A pull request asks a person to accept it. Merging is the acceptance |
| Claude Code | Writes the code from the accepted plan | It obeys `CLAUDE.md`, uses the skills in `.claude/skills/`, and is stopped by the hooks in `.claude/hooks/` |
| Vercel | Serves `public/` and runs `api/` functions | Secrets live in its environment variables, never in files |
| Supabase | Database, sign-in, row-level security | RLS means a table refuses everyone by default, then opens by rule |
| Chain (this repo) | Reads, derives, shows | Read-only toward GitHub and PM tools |

## 2. Ground rules

1. No code before an intent, a spec and a **merged** plan. Skills: `intent`, `spec`.
2. A hard-to-reverse decision gets an ADR first. Skill: `adr`.
3. Small fixes use the light path: `Light change: <reason>` in the PR body, under 5 files and 150 lines ([ADR-0011](adr/0011-light-path-for-small-changes.md)).
4. Branch `claude/intent-<slug>`. One pull request per group of plan steps. You accept by merging.
5. A person pushes to production and applies migrations. The hooks block Claude from doing it.
6. A claim about another tool links to a row in [landscape](landscape.md).
7. Status is never written in a file. It comes from pull request state ([ADR-0003](adr/0003-status-derived-from-pr-state.md)).

## 3. The loop for every slice

| Step | You do | Claude Code does | Done when |
|---|---|---|---|
| 1 Intent | Say the goal | Branch, `intent.md` via the `intent` skill, PR | You merge the PR |
| 2 Spec | Review criteria | `spec.md` via the `spec` skill, PR | Every criterion is testable; you merge |
| 3 Plan | Review steps | Plan mode, `plan.md` committed, PR | Steps are ordered and each has a check; you merge |
| 4 Build | Watch the PRs | One plan step group per PR, tests first | Tests pass, `architecture-guard` run |
| 5 Verify | Try it in a browser | Fills "Verification" in the PR | You saw the demo moment work |
| 6 Review | Read findings | Review passes from `REVIEW.md` | No Important findings left |
| 7 Merge | Merge | Nothing | Slice is `shipped` on Chain's own board |

Prompts to paste into Claude Code, opened in the cloned repository:

**Intent**
```
Read CLAUDE.md, intent/chain/spec.md and docs/architecture.md.
We start slice <S0>. Use the intent skill to write intent/<slice-slug>/intent.md
for capability <slug>. Create branch claude/intent-<slice-slug>, open a PR with
that file only, then stop.
```

**Spec, after the intent is merged**
```
Use the spec skill on intent/<slice-slug>/intent.md. Acceptance criteria must be
testable and reuse the feature IDs from the umbrella spec. Check docs/adr for
conflicts. Open a PR with spec.md only, then stop.
```

**Plan, after the spec is merged**
```
Enter plan mode. Write intent/<slice-slug>/plan.md: ordered steps, files to touch,
and how each step is verified. Start each step with its test. Commit the plan,
open a PR with plan.md only, then stop.
```

**Build, after the plan is merged**
```
Implement steps <1 to 3> of intent/<slice-slug>/plan.md on a new branch. Tests
first. Run the architecture-guard skill. In the PR, fill "Plan match",
"Divergences from plan" and "Verification". Do not touch migrations or deploy.
```

**Light change**
```
Fix <problem>. This is a light change: no intent folder. Keep it under 5 files
and 150 lines. PR body: "Light change: <reason>".
```

## 4. Slices

| Slice | Build | Files (from [architecture §10](architecture.md#10-repository-structure)) | Tests first | Needs | Before you start |
|---|---|---|---|---|---|
| **S0** Walking skeleton | Parse a repo's `capabilities/` and `intent/`, render one board and one feature chain | `lib/parse/artifact.js`, `lib/connectors/github.js`, `api/demo.js`, `public/` (router, board, feature views), `fixtures/` | Parser unit tests on the fixture | Demo token | Nothing blocking |
| **S1** State | Artifact state, lifecycle, waiting queue, PR classification (feature, light, unlinked), webhook sync | `lib/reconcile/state.js`, `lib/parse/pr-body.js`, `lib/store/`, `api/webhooks/` | Reconcile fixtures with exact expected output | Supabase, GitHub App | Spike S-C (REST or GraphQL) |
| **S2** Drift | One file per rule: rework, divergence, compliance finding, bypass, light-path size | `lib/reconcile/signals/*.js`, `lib/parse/findings.js` | One fixture case per signal | None | Spike S-D (real review findings) |
| **S3** Connect | Sign-in, install flow, multi-repo, portfolio, settings | `api/`, `public/` views | Contract tests with recorded GitHub responses | None new | Spike S-B (sign-in model) |
| **S4** Finish | Previews, source labels, design node, links, themes, start prompt | `public/`, `lib/parse` | End-to-end walk-through | None new | Design round done (see `design/README.md`) |

After 1.0: spike S-A then session data; S-F then format readers; S-G then PM-tool connectors.

A **spike** is a question with a time limit of half a day. Its output is a "Spike result" section added to the related ADR, with sources and the changed status. No code from a spike is kept unless a slice's plan says so.

## 5. Tests

- **Fixtures first.** Build the fixture repository with known drift before the rules. It includes one case per signal in the spec and a repo that does not follow the convention.
- **Pure core.** `reconcile` takes observations and config and returns state. Same input, same output. No network, no clock, no randomness.
- **Connectors** are tested against recorded responses.
- **End to end:** after each slice, run the demo moment from the slice table against Chain's own repository.

## 6. Definition of done for a pull request

- Tests pass; the demo moment works in a browser.
- `architecture-guard` run; its findings are fixed or listed.
- "Divergences from plan" filled in honestly (write "None" if none).
- Docs updated (section 7).
- No secret and no employer, organisation or personal detail in any file.
- Internal links use `/#/route`.

## 7. Keeping everything consistent

When you change one thing, change its neighbours in the same pull request.

| You change | Also update |
|---|---|
| A feature (add, move, remove) | `spec.md` feature table, release table and slice table; the capability file's feature list |
| A decision | New ADR and the [ADR index](adr/README.md); any doc that cites the old one |
| A drift rule | `spec.md` §7; `lib/reconcile/signals/`; fixtures; `REVIEW.md` if tags change; the migration if a new attachment is needed |
| A table or column | A new migration (never edit an applied one); `architecture.md` §7; the Tables line in `CLAUDE.md` |
| A route | `spec.md` §8; the Routes line in `CLAUDE.md`; `design/README.md` if the design lacks it |
| An environment variable | `SETUP.md`, `architecture.md` §11, `CLAUDE.md` |
| A claim about another tool | A row in [landscape](landscape.md), with date and source |
| The light-path thresholds | `chain.yml`, `templates/chain.yml`, ADR-0011, `REVIEW.md`, `CLAUDE.md` |

Migration note: `migrations/001_initial_schema.sql` has not been applied anywhere yet, so it can still be edited. After it is applied, every change is a new numbered file.

## 8. Traps

| Trap | Instead |
|---|---|
| Letting Claude Code start building after the intent | Stop at each merge; the prompts above end with "then stop" |
| Writing a status in a file | Derive it; ADR-0003 |
| Putting a rule inside a connector | Connectors only observe; rules live in `reconcile` |
| Calling an AI model to judge drift | Not in v1; ADR-0008 |
| Using the light path for a feature | The size guard and review will flag it; open a full intent instead |
| Branch protection "not enforced" | On a private repository on a free plan GitHub does not enforce it; keep the discipline until the repository is public |
| Uploading hidden folders in the web page | Use the web editor (press `.`) or a terminal; dot-folders are skipped by drag-and-drop |

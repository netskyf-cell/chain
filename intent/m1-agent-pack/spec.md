---
slug: m1-agent-pack
intent: chain
produced_with: claude-code
---
# Spec: first milestone, the agent pack

Derived from the product intent [`intent/chain/intent.md`](../chain/intent.md) (merged in PR #1). This milestone has no intent file of its own: the product intent is its intent. Connector facts come from the [connector spike](../../docs/spikes/2026-11-02-connectors.md).

**Goal.** A team on GitHub Copilot (or Claude Code), with decisions in Azure DevOps and Confluence Cloud and code on GitHub or ADO Repos, installs Chain in one sitting and opens a board that answers the four questions of the intent. All three agents ship in this milestone (owner's decision, 2026-11-02).

Analogy: an air-traffic tower. The setup agent draws the map of the airport once, the review agent inspects each plane at the gate, the collector reads every radar, and the rules engine is the controller's rulebook. The board is the screen.

## 1. Scope

### In

| Part | Ships as |
|---|---|
| Setup agent | One instruction file, plus an adapter for Copilot and one for Claude Code |
| Compliance review agent | Same |
| Collector agent | Same |
| Rules engine | Node module and CLI `chain rules`, ported from `chain-v1/lib/reconcile` and `lib/parse` |
| Board | `chain board`: one self-contained HTML file, opened from disk |
| Contract 0.2 | Raw review and PR text in the observations file; parsing moves to code (§3) |
| Install | `chain install --target copilot|claude` copies the agent files into a team's repository |

### Out (later milestones)

- Azure DevOps Server and Confluence Data Center (no supported connector, see spike).
- GitLab and other code hosts.
- Optional hooks (ADR-0002 lists them as optional).
- v1 history rules (intent rework, spec rework, plan revised, change outside a PR).
- Portfolio across teams, live refresh, any server.

## 2. Decisions this spec proposes

The owner accepts these by merging, or comments on the PR.

| # | Decision | Why |
|---|---|---|
| D1 | **The board is a single HTML file** that `chain board` writes, with the verdicts embedded. No server, no `npm start`. | Opens from disk on a locked-down laptop; browsers block a page on disk from reading a separate JSON file. Answers intent open question 3. |
| D2 | **The collector copies raw text; code parses it.** Review comments and PR descriptions go into the observations file verbatim; the ported parsers extract findings and divergences. | ADR-0001 applied strictly: an agent transcribing finding lines can drop or reword one, and a parser cannot. Needs contract 0.2. |
| D3 | **A change linked to a spec or intent item counts as mandated.** "Out of order" applies only to links to plan items. | Many teams link PRs to a Feature, not a story. Answers contract open question 2. |
| D4 | **Criteria ids:** use `AC-n` when the text has it; otherwise number by position. | Simple and visible. The fragility is listed as a risk (R4). |
| D5 | **The review agent reads the diff from local git** and uses connectors only to find criteria and post its comment. | ADO's connector gives a file list, not a diff; every developer has the branch checked out. |
| D6 | **Two connector configurations.** The collector and setup agents use read-only connectors (ADO `X-MCP-Readonly`, GitHub `--read-only`). The review agent may also create one PR comment thread. | Read-only by configuration, not by promise. |
| D7 | **Agent files have one canonical source** in `agents/`, and adapters are generated from it. A test fails when an adapter is out of date. | Two copies drift. |

## 3. Contract change: `chain.observations/0.2`

Changes to [`observations.schema.json`](../../docs/contract/observations.schema.json), with ADR-0003 updated in the same PR:

| Field | 0.1 | 0.2 |
|---|---|---|
| `change.body` | absent | Raw PR description text, or `null` |
| `change.divergences` | collector writes it | Removed; the rules derive it from `body` |
| `change.reviews[].body` | absent | Raw text of the review or comment, required |
| `change.reviews[].findings` | collector writes it | Removed; the rules derive it from `body` |
| `items[].criteria[].idSource` | absent | `text` or `position` (D4) |
| `sources[].connector` | absent | Which connector read it, e.g. `ado-remote`, `ado-local`, `rovo`, `github`. Shown on the board; rules never read it (ADR-0003). |

The schema, the example, the contract README and its version change together (architecture guard).

## 4. Acceptance criteria

Each criterion is testable. "Test" means an automated test in `npm test`; "Check" means a recorded manual step in the PR's Verification section.

### 4.1 Setup agent

| ID | Criterion | Verified by |
|---|---|---|
| AC-S1 | Before anything else, the agent checks each connector it needs and reports, per source, one of: reachable, not configured, blocked by policy, sign-in needed. It names the policy or admin setting in plain words (for example "MCP servers in Copilot" or the Atlassian domain allowlist). | Check |
| AC-S2 | It lists the work item types (or page spaces) it finds and proposes a role mapping in the team's words, then asks the person to confirm or edit it. | Check |
| AC-S3 | It writes `chain.yml` that passes `chain validate --config`, and stops there: the team merges it like any change. | Test (config schema), Check |
| AC-S4 | It finds the acceptance-criteria field (ADO field name or Confluence page section) from a sample of items and asks the person to confirm. | Check |
| AC-S5 | It calls no write tool on any source. | Check: tool log of the session |

### 4.2 Compliance review agent

| ID | Criterion | Verified by |
|---|---|---|
| AC-R1 | Given a PR, it finds the linked decision items through `chain.yml` (native links, `AB#123`, URL) and reads their criteria. | Check |
| AC-R2 | It writes exactly one verdict per criterion it found: `Met` with evidence, or `Important`/`Block` with what is missing and a file and line. | Test: output of a fixture run parses with the findings parser |
| AC-R3 | When it finds no criteria, it writes one `[compliance] Unverifiable:` line saying why. | Test (fixture) |
| AC-R4 | It reads the change from local `git diff <base>...<head>`, never from a connector (D5). | Check |
| AC-R5 | It shows the comment to the person and posts it only after they confirm, as one comment on the PR. | Check |
| AC-R6 | Re-run on the v1 PR from the 2026-11-02 spike, it reports the same two gaps (delivery recorded before processing; different 404 body). | Check: findings compared with the spike |

### 4.3 Collector agent

| ID | Criterion | Verified by |
|---|---|---|
| AC-C1 | It writes `chain/observations.json` that passes `chain validate`, including the referential checks (no duplicate ids, no link or parent to an unknown id). | Test of `validate`; Check of a real run |
| AC-C2 | Every source in `chain.yml` appears in `sources`, with `read: false` and a plain-words `reason` when it could not be read, and `partial: true` when a limit stopped it. | Test of `validate` rule; Check |
| AC-C3 | It reads items updated within `collect.since_days` (default 90) and every ancestor and linked item of those, so no link points outside the file. | Check |
| AC-C4 | For ADO items that hold criteria, it fills `criteria[].changedAt` from revisions. For Confluence it writes `null`. | Check |
| AC-C5 | Review and PR text is copied verbatim into `body` (D2). | Check: 3 bodies compared character by character with the source |
| AC-C6 | Two runs with no source changes in between give the same items. `chain compare a.json b.json` ignores `collectedAt` and exits 0. | Test of `compare`; Check of two real runs |
| AC-C7 | The file holds no verdict, severity or drift field. | Test: schema has no such field |
| AC-C8 | It uses only read-only connector configurations (D6). | Check: config shown in the PR |

### 4.4 Rules engine

| ID | Criterion | Verified by |
|---|---|---|
| AC-E1 | The eight rules in the [contract README](../../docs/contract/README.md) are implemented, one pure function each, each with a test that raises it and one that does not. | Test |
| AC-E2 | Same observations file in, byte-identical verdicts out. The rules read the clock only from `collectedAt`. No network, no randomness, no AI call. | Test (run twice, compare); `architecture-guard` |
| AC-E3 | The findings parser reads `Met` and `Unverifiable` as well as `Block`, `Important`, `Nit`, and ignores lines in code blocks. Ported v1 tests pass. | Test |
| AC-E4 | When several reviews carry compliance findings, the latest one counts. | Test |
| AC-E5 | A rule that needs a source marked `read: false` raises nothing and reports "not checked: <source>" instead. | Test |
| AC-E6 | Every verdict names its rule, the items involved, and a URL to the evidence. | Test |
| AC-E7 | `examples/observations.example.json` produces exactly the verdicts listed in the contract README's example column. | Test |

### 4.5 Board

| ID | Criterion | Verified by |
|---|---|---|
| AC-B1 | `chain board` writes one HTML file that opens from disk with no network request. | Test: no `http` reference outside source links; Check in a browser offline |
| AC-B2 | It answers the intent's four questions, in this order: where each decision stands, decisions with no code and code with no decision, criteria not met with evidence, changes nobody checked. | Check |
| AC-B3 | It uses the team's words. With vocabulary set to test words, the rendered page shows them and never Chain's role names. | Test |
| AC-B4 | Sources not read, and rules not checked, appear at the top in plain words. | Test |
| AC-B5 | Each signal links to the item in its source tool. | Test |
| AC-B6 | It reuses v1's tokens and look (`public/css/tokens.css`, `app.css`). | Check |

### 4.6 Install and package

| ID | Criterion | Verified by |
|---|---|---|
| AC-I1 | `chain install --target copilot` and `--target claude` write the three agents to the paths each tool reads, and nothing else. | Test (temp folder) |
| AC-I2 | Adapters match the canonical files in `agents/` (D7). | Test |
| AC-I3 | Runs on Node 20+ with no runtime dependency beyond the JSON-schema validator. | Test (CI matrix or `engines`) |
| AC-I4 | A README section takes a new team from install to board in under an hour, including the policy checks of AC-S1. | Check: one person outside the project follows it |

### 4.7 Milestone exit (the benchmark)

Not a build criterion; it decides whether the milestone delivered value.

| ID | Criterion |
|---|---|
| AC-X1 | On 5 merged PRs from the pilot team, the review agent finds at least 1 real gap, and under 30% of its `Important`/`Block` findings are rated noise by the product owner. |
| AC-X2 | The product owner reads the board without help and can name one decision they would act on. |

## 5. Files and data touched

| Path | Change |
|---|---|
| `agents/{setup,compliance-review,collector}.md` | New, canonical agent instructions |
| `adapters/copilot/`, `adapters/claude/` | Generated |
| `lib/rules/`, `lib/parse/` | Ported from v1, rewritten to read the observations file |
| `lib/board/`, `lib/board/css/` | New renderer, v1 styles |
| `bin/chain.js` | CLI: `validate`, `compare`, `rules`, `board`, `install` |
| `docs/contract/observations.schema.json`, `docs/contract/README.md`, `docs/adr/0003-*.md` | Contract 0.2 |
| `docs/contract/chain-yml.schema.json` | New: schema for `chain.yml` |
| `examples/` | Updated to 0.2, plus fixtures for each rule |
| In the team's repository | `chain.yml`, agent files, `chain/observations.json` (team decides whether to commit it) |

Nothing is written to any tracker, wiki or code host by Chain's code. The only write is the review agent's PR comment, through the team's connector and with a person's confirmation (ADR-0001).

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The pilot organisation has "MCP servers in Copilot" off, or Atlassian admins have not allowed the client. Nothing can be read. | AC-S1 detects and names it. Ask before the pilot starts (owner to-do). |
| R2 | The ADO organisation is not Entra-backed, or Confluence is Data Center. | Spike scope: both out of M1. Confirm before the pilot. |
| R3 | The collector agent transcribes data wrongly at volume. | D2 keeps judgement-bearing text raw; AC-C6 catches instability; `since_days` keeps volume small. |
| R4 | Position-based criteria ids shift when a line is inserted, faking "Moved goalposts". | D4 prefers `AC-n` in text; the setup agent suggests the team number its criteria. |
| R5 | The remote ADO server is in preview and its tools change. | Agent instructions name tools by job, with current names as examples; `sources[].connector` records which server read the data. |
| R6 | Node or `npx` is blocked on the team's machines. | Check with the pilot team; fall back to running `chain` in CI. |
| R7 | Copilot and Claude Code read agent files from different paths, and those paths change. | D7 and AC-I2; the landscape doc cites the paths. |

## 7. Open questions for the owner

1. Pilot team: is its ADO organisation Entra-backed, and is its Confluence Cloud? (Decides R2.)
2. Who can confirm the Copilot MCP policy and the Atlassian allowlist at the pilot company? (Decides R1.)
3. Is the pilot team's code on GitHub or ADO Repos?
4. Should `chain/observations.json` be committed (history for free, but internal data in the repository) or ignored?

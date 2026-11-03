# The observations contract

**One file is the boundary between the agents and the code.** The collector agent writes it; the rules engine and the board read only it ([ADR-0003](../adr/0003-role-model-and-observations-contract.md)). Version: `chain.observations/0.2`, draft.

- Schema: [`observations.schema.json`](observations.schema.json) (JSON Schema 2020-12)
- Team configuration schema: [`chain-yml.schema.json`](chain-yml.schema.json)
- Which signal fills which field: [signal catalogue](signals.md)
- Example: [`examples/observations.example.json`](../../examples/observations.example.json), for the team configured in [`examples/chain.example.yml`](../../examples/chain.example.yml)
- Check a file: `npm test` checks the examples; `lib/validate.js` checks any file

Think of it as a customs form: whatever country a parcel comes from, the form has the same boxes, so the inspector never needs to know the sender's language.

## Shape

| Part | Holds |
|---|---|
| `sources` | Every source `chain.yml` lists, whether it was read, and which connector read it. A source not read is shown, not hidden. |
| `items` | One entry per intent, spec, plan or change, whatever tool it came from |
| `item.role` | `intent`, `spec`, `plan` or `change`. Outcome is derived from merged changes. |
| `item.state` | `open`, `active`, `done`, `removed`. The source's own word stays in `sourceState`. |
| `item.createdAt` | When the item was created; the earliest item in a decision's chain is where it **started** |
| `item.parent` | The item one role up (a story's Feature, a Feature's Epic) |
| `item.links` | From a change to the decisions it delivers, and between decisions in different tools, with how each link was found (`ab-mention`, `native`, `url`, `branch`, `folder`) |
| `item.criteria` | Acceptance criteria, on the item that holds them, with whether the id was written or assigned by position, and when each last changed |
| `item.change` | Raw facts about a pull request: merged, repository, branch, labels, author, description, commits with their trailers, reviews with their text |

## The collector copies; rules classify

Since 0.2 the collector writes no judgement ([ADR-0001](../adr/0001-agents-collect-rules-decide.md)). It copies text and accounts as the source shows them. The rules derive:

| Derived by rules | From |
|---|---|
| Review findings (`[pass] Severity: text`, [`REVIEW.md`](../../REVIEW.md)) | `reviews[].body` |
| Declared divergences | The `Divergences from plan` section of `change.body` |
| Commit and PR authorship: person, agent, mixed, unknown | `author`, `branch`, `labels`, `commits[].author`, `commits[].trailers`, matched against `authorship` in `chain.yml` |
| Where an agent ran: cloud or local | Bot account opened the PR → cloud; agent evidence in commits or branch with a person as PR author → local |
| Whether a review is a person's check | Author is not an agent account, and the review approves or requests changes, or has text other than tagged findings |

The compliance review agent writes one verdict per criterion: `Met`, `Important` or `Block` (not met), `Nit`, or `Unverifiable`. It posts through the person's own account, so its comment is recognised by its tagged lines, not by its author.

## The rules this contract feeds

Each rule reads only fields above. The example file contains one case of each.

| Rule | Kind | Raised when | Example |
|---|---|---|---|
| Done without proof | traceability | A plan item is `done` and no merged change links to it | `ado:112` |
| Change without a mandate | traceability | A merged change links to no plan, spec or intent item | `gh:42` |
| Out of order | traceability | A merged change links to a plan item still `open` | `gh:43` → `ado:113` |
| Moved goalposts | traceability | A criterion's `changedAt` is after a linked change's `mergedAt` | `ado:110` AC-3 after `gh:41` |
| Stalled intent | traceability | An `active` intent has no merged change under it for `stalled_after_days` | `ado:200` |
| Criterion not met | content | The latest compliance review has a finding at `Important` or `Block` | `gh:41` AC-2 |
| Unverified | content | A merged change has no compliance verdict, or only `Unverifiable` | `gh:42`, `gh:43` |
| Declared divergence | content | The PR description has a non-empty `Divergences from plan` section other than "None" | `gh:41` |
| Agent change, no person reviewed | content | A merged change is agent or mixed, and no person's review is on it | `gh:43` |

When a source is not read, or only partly read:

- rules that need **every** item of a role (Done without proof and Stalled intent need every change; Change without a mandate needs every decision; Out of order needs every plan item) raise nothing and report "not checked";
- rules that judge one change at a time still run on what was read, and list the unread source as a caveat.

## What the rules engine writes

`chain rules` writes `chain.verdicts/0.1`: the team, `collectedAt`, the sources and whether each was read, `signals` (rule, items, message, evidence with URLs), `notChecked` (rule, sources, whether it was skipped), and `facts` (per decision, per change, team totals). It is internal to Chain: the board reads it; no other tool should.

v1's history rules (intent rework, spec rework, plan revised, change outside a PR) need file history. They return for teams whose decisions live in repository files (`git-files` source).

## Facts

Neutral answers shown on the board, never called drift.

| Fact | Derived from | Example |
|---|---|---|
| Started in | Earliest `createdAt` among a decision's linked and parent items | Driver self-service started in the wiki (`wiki:9001`) |
| Path across tools | Links and parents, in time order | `wiki:9001` → `ado:100` → `ado:110` → `ado:111` → `gh:41` |
| Where built | `source` and `change.repository` of merged changes | `gh`, `example/fleet-portal` |
| Agent share | Agent commits ÷ all commits | `gh:41` mixed (local agent), `gh:42` person, `gh:43` agent (cloud) |
| Checked by | Person reviews and compliance reviews per change | `gh:41` both; `gh:42` none; `gh:43` compliance only |

## Rules for the collector

- Write every field from a source; invent none. Unknown is `null` or absent.
- Copy text verbatim: descriptions, review bodies, trailers. Never summarise or reformat them.
- Item ids are `<source id>:<id in that source>`.
- Never drop an item because it looks irrelevant. The rules decide.
- Normalise states with the mapping in `chain.yml` when the team has custom states.

## Changes from 0.1

| Change | Why |
|---|---|
| Added `change.body`, `repository`, `branch`, `labels`, `author`, `commits[]`; `reviews[].author`, `state`, `body` | Raw evidence for where code was built and by whom (signal catalogue) |
| Removed `change.authorKind`, `agent`, `divergences`; `reviews[].byKind`, `findings` | Classifying and parsing move from the collector to the rules (ADR-0001; spec D2, plan P1) |
| Added `criteria[].idSource`, `sources[].connector` | Spec D4 and §3 |
| `change.commits` and `change.reviews` required | A change with no evidence must say so (`commits: null`, `reviews: []`) |

## Open questions

1. How are criteria identified when the source has no ids? By position is fragile if a line is inserted (spec R4).
2. Confluence keeps page versions, but no connector tool found so far returns them, so `changedAt` is `null` for Confluence criteria ([spike](../spikes/2026-11-02-connectors.md)).

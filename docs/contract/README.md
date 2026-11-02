# The observations contract

**One file is the boundary between the agents and the code.** The collector agent writes it; the rules engine and the board read only it ([ADR-0003](../adr/0003-role-model-and-observations-contract.md)). Version: `chain.observations/0.1`, draft.

- Schema: [`observations.schema.json`](observations.schema.json) (JSON Schema 2020-12)
- Example: [`examples/observations.example.json`](../../examples/observations.example.json), for the team configured in [`examples/chain.example.yml`](../../examples/chain.example.yml)

Think of it as a customs form: whatever country a parcel comes from, the form has the same boxes, so the inspector never needs to know the sender's language.

## Shape

| Part | Holds |
|---|---|
| `sources` | Every source `chain.yml` lists, and whether it was read. A source not read is shown, not hidden. |
| `items` | One entry per intent, spec, plan or change, whatever tool it came from |
| `item.role` | `intent`, `spec`, `plan` or `change`. Outcome is derived from merged changes. |
| `item.state` | `open`, `active`, `done`, `removed`. The source's own word stays in `sourceState`. |
| `item.parent` | The item one role up (a story's Feature, a Feature's Epic) |
| `item.links` | From a change to the decisions it delivers, and how the link was found (`ab-mention`, `native`, `url`, `branch`, `folder`) |
| `item.criteria` | Acceptance criteria, on the item that holds them, with when each last changed |
| `item.change` | Merged or not, who wrote it (person or agent), declared divergences, and review findings |

Review findings use the [`REVIEW.md`](../../REVIEW.md) format. The compliance review agent writes one verdict per criterion: `Met`, `Important` or `Block` (not met), `Nit`, or `Unverifiable`.

## The rules this contract feeds

Each rule reads only fields above. The example file contains one case of each.

| Rule | Kind | Raised when | Example |
|---|---|---|---|
| Done without proof | traceability | A plan item is `done` and no merged change links to it | `ado:112` |
| Change without a mandate | traceability | A merged change has no link | `gh:42` |
| Out of order | traceability | A merged change links to a plan item still `open` | `gh:43` → `ado:113` |
| Moved goalposts | traceability | A criterion's `changedAt` is after a linked change's `mergedAt` | `ado:110` AC-3 after `gh:41` |
| Stalled intent | traceability | An `active` intent has no merged change under it for `stalled_after_days` | `ado:200` |
| Criterion not met | content | A compliance finding at `Important` or `Block` | `gh:41` AC-2 |
| Unverified | content | A merged change has no compliance verdict, or only `Unverifiable` | `gh:42`, `gh:43` |
| Declared divergence | content | `change.divergences` is not null | `gh:41` |

v1's history rules (intent rework, spec rework, plan revised, change outside a PR) need file history. They return for teams whose decisions live in repository files (`git-files` source).

## Rules for the collector

- Write every field from a source; invent none. Unknown is `null` or absent.
- Item ids are `<source id>:<id in that source>`.
- Never drop an item because it looks irrelevant. The rules decide.
- Normalise states with the mapping in `chain.yml` when the team has custom states.

## Open questions

1. ADO keeps field history. Is reading it allowed and cheap enough to fill `criteria[].changedAt`?
2. Should a change linked only to a spec or intent (not a plan item) count as mandated?
3. How are criteria identified when the source has no ids (a free-text field)? By position is fragile if a line is inserted.

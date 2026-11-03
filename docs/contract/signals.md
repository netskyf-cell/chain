# Signal catalogue

Every signal Chain captures, where it lives, how the collector reads it, which field of the [observations file](README.md) it fills, and what uses it. Agents, rules and board work from this one list.

Think of a parcel crossing several carriers. The carriers (Azure DevOps, Confluence, GitHub, local git) are just transport. Chain reads the **stamps**: where the parcel was posted, which depots it passed through, who handled it, who inspected it.

Two kinds of output come from these signals:

- **Facts**: neutral answers, such as "this decision started in a wiki page" or "agents wrote 70% of the commits". Shown on the board, never called drift.
- **Signals**: drift, raised by a rule ([contract README](README.md#the-rules-this-contract-feeds)).

The collector copies what it reads; rules classify it (ADR-0001). Patterns that recognise agents live in `chain.yml`, so a team adds a new agent without new code.

## 1. Where did the intent start?

| Signal | Lives in | Read as | Fills | Used by |
|---|---|---|---|---|
| Decision item exists | ADO Epic or Feature, Confluence page, `intent.md` / `spec.md` in a repository | Item with its role from `chain.yml` | `items[]` with `role`, `source`, `type` | Every rule |
| When it was created | Same | Creation date | `items[].createdAt` | Fact: **started in** (earliest item in a decision's chain) |
| Parent decision | ADO parent link; Confluence page tree; folder | Relation or ancestor | `items[].parent` | Path view; Stalled intent |
| Cross-tool link | ADO hyperlink to a Confluence page; a page link to a work item | Link whose target is another source's item | `items[].links[]` with `via: url` | Fact: **path across tools** |

## 2. What exactly was decided?

| Signal | Lives in | Read as | Fills | Used by |
|---|---|---|---|---|
| Acceptance criteria | ADO field named in `chain.yml`; a page section; a `spec.md` section | Text, one criterion per line | `items[].criteria[]` | Review agent; Criterion not met |
| Criterion id | `AC-n` in the text, otherwise position | Pattern match, else index | `criteria[].id`, `criteria[].idSource` | Moved goalposts |
| Criterion last changed | ADO revisions | Latest revision where the field text differs | `criteria[].changedAt` (Confluence: `null`) | Moved goalposts |
| State | Work item state, page status | Source word, mapped by `chain.yml` | `items[].state`, `items[].sourceState` | Done without proof; Out of order; Stalled intent |

## 3. Where was the code written?

| Signal | Lives in | Read as | Fills | Used by |
|---|---|---|---|---|
| Change exists | GitHub PR, ADO Repos PR | PR | `items[]` with `role: change` | Every change rule |
| Code host and repository | Same | Source id and repository name | `items[].source`, `change.repository` | Fact: **where built** |
| Link to a decision | Native ADO link (PR work-item refs); `AB#123` in title or body; URL; branch name | Each link with how it was found | `items[].links[]` with `via` | Change without a mandate; Out of order |
| Merged, and when | PR | Merge state and date | `change.merged`, `change.mergedAt` | Every merged-change rule |
| PR description | PR | Verbatim text | `change.body` | Rules parse `Divergences from plan` (Declared divergence) |

## 4. Who or what wrote it?

The collector copies the raw evidence. Rules classify each commit and the PR as **person**, **agent** or **unknown**, using the patterns in `chain.yml` under `authorship`.

| Signal | Lives in | Read as | Fills | Default pattern (team can change) |
|---|---|---|---|---|
| PR opened by a bot account | PR author | Login and account type | `change.author` `{ login, isBot }` | Bot account whose login matches a known agent, e.g. the Copilot cloud agent |
| Agent branch prefix | Source branch | Branch name | `change.branch` | `copilot/`, `claude/`, `codex/`, `cursor/` |
| Agent label | PR labels | Label names | `change.labels[]` | Labels listed in `chain.yml` |
| Commit author | Each commit | Author name and email, bot flag | `change.commits[].author` | Bot accounts listed in `chain.yml` |
| Co-author trailer | Each commit message | `Co-Authored-By:` lines, verbatim | `change.commits[].trailers[]` | A trailer naming an agent, e.g. `Claude`, `Copilot` |

Derived by rules, never collected:

| Output | Rule |
|---|---|
| Commit is agent-written | Any commit-level pattern matches |
| PR authorship: `person`, `agent`, `mixed`, `unknown` | All commits agent → agent; none → person; some → mixed; no evidence → unknown |
| Where the agent ran: `cloud` or `local` | PR opened by a bot account → cloud; agent trailers or prefix with a person as PR author → local |
| Fact: **agent share** | Agent commits ÷ all commits, per decision and per team |

Patterns are defaults to confirm on the pilot team's real data before they ship.

## 5. Who checked it?

| Signal | Lives in | Read as | Fills | Used by |
|---|---|---|---|---|
| Review or comment | GitHub reviews and comments; ADO PR threads | Verbatim text, author, date | `change.reviews[]` `{ at, url, author, body }` | Rules parse `[pass] Severity:` lines with the ported parser |
| Reviewer is a person or an agent | Review author | Login and bot flag, matched against `chain.yml` | `change.reviews[].author` | Fact: **checked by**; rule Agent change, no person reviewed |
| Compliance verdicts | `[compliance]` lines | Parsed by rules | Derived, not stored | Criterion not met; Unverified |

## 6. Was a source read at all?

| Signal | Lives in | Fills | Used by |
|---|---|---|---|
| Source read, partly read, or not | Collector run | `sources[]` `{ read, partial, reason, connector }` | Board banner; every rule reports "not checked" instead of guessing |

## Not captured, on purpose

- Prompts, chat transcripts, agent session logs (intent non-goal).
- Code quality scores, people scores, time tracking.
- Anything from outside the sources listed in `chain.yml`.

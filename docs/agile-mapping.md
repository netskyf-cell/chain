# How Agile and Product Management map onto Chain

Chain adds a visibility layer in GitHub. It keeps the intent of Product Management and Agile practice and is explicit about what it does not do.

Read this table as a **mapping of intent**, not an equivalence. Chain does not replace any practice. It makes the evidence of a practice visible, or shows where the practice was skipped.

## Practice to evidence

| Practice | Intent of the practice | Where it lives | What Chain shows |
|---|---|---|---|
| **Vision and outcomes** (OKRs, product goals) | Say what we are trying to achieve and why | `capabilities/<slug>.md`, written as a user goal | Capability board: statement, owner, target, progress, health |
| **Discovery and framing** | Understand the problem before solving it | `intent/<slug>/intent.md` | Intent state: proposed or accepted, and how long it has waited |
| **Backlog** | Hold the ordered work | Jira, Linear or Azure DevOps (linked, not copied) | Work-item chips on the intent, spec and plan; link health (1.2) |
| **Refinement** | Make work ready by clarifying and splitting | The pull request that proposes `spec.md` | Spec state, review conversation as a link, rework signals if the spec changes later |
| **Definition of Ready** | Agree that work can start | Accepted intent, accepted spec, accepted plan | Lifecycle moves to `building` only when the plan is accepted |
| **Sprint planning, sprints, velocity** | Time-box and forecast | The PM tool | **Not shown.** Chain has no sprints, estimates or velocity |
| **Product owner acceptance** | A named person decides | Merging the artifact's pull request | Queue of artifacts waiting for a decision, with age |
| **Definition of Done** | Agree what "finished" means | `REVIEW.md` passes, CI, a merged pull request | Shipped lifecycle, review findings by pass, verification section of the PR |
| **Increment** | A usable slice of value | A merged build pull request | Feature moves to `shipped`; capability progress advances |
| **Sprint review** | Inspect what was delivered | Capability and portfolio views | Capability detail, portfolio, shareable read-only view (1.1) |
| **Retrospective** | Learn from how work went | Drift signals and rework counts | Signals with evidence, lead times, rework per feature (1.1) |
| **Impediments** | Make blockers visible | Pull requests that stall or change requests | `blocked` health, with the stated reason |
| **Small fixes and maintenance** | Keep process proportionate to the change | A pull request with `Light change: <reason>` | Listed per repository and capability with size; a size guard flags light changes that are really features ([ADR-0011](adr/0011-light-path-for-small-changes.md)) |
| **Governance and compliance** | Show controls worked | Hooks, review findings, protected branches, the commit chain | Hook decision log (1.1), `gate_bypassed` signal, readiness check |

## What changes for the people involved

| Role | Keeps doing | Newly sees |
|---|---|---|
| Product manager / owner | Writing intents, accepting by merging, prioritising in the PM tool | Everything waiting for their decision in one place, and whether shipped work matches what they accepted |
| Product leader | Reviewing outcomes with teams | A portfolio view without opening repositories |
| Scrum master / agile coach | Facilitating, coaching on flow | Evidence of where flow stalls (waiting age, blocked, rework) instead of anecdotes |
| Engineer / builder | Working with a coding agent and Git | Their chain rendered for non-engineers, with no extra reporting |

## What Chain deliberately does not do

- It does not rank, estimate or schedule work.
- It does not tell a team how to run ceremonies.
- It does not ask anyone to enter status. State comes from Git.
- It does not grade people. Signals attach to artifacts, not to individuals.

## Why a layer in GitHub, and not another tool

Teams that work with AI agents already commit the evidence that PM and Agile practices produce: who asked for what, what was decided, what was built, who approved it. Chain reads that evidence. That is why it needs no new process and no double entry. The practice stays where it is, and the evidence becomes visible.

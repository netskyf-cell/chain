---
product: chain
capability: all
produced_with: claude-ai
---

# Intent: Chain

Author: Frédéric Gilbert (product builder).

> This is the product-level intent. It answers **why** Chain exists and **what** it must achieve.
> **How** it is built is in [`spec.md`](spec.md), [`docs/architecture.md`](../../docs/architecture.md) and the [ADRs](../../docs/adr/README.md).
> Its approval state is not written in this file. It is derived from the pull request that merged it (see [ADR-0003](../../docs/adr/0003-status-derived-from-pr-state.md)).

## Problem

AI has made writing code fast. The slow parts are now the human-speed steps around it: deciding what to build, reviewing what was built, and deciding whether to ship. Anthropic's AI-Native SDLC playbook (August 2026) makes the same point: when code is no longer the bottleneck, the bottleneck moves to planning, review and deployment.

Teams that adopt this way of working end up with a chain of committed files for every feature: `intent.md`, `spec.md`, `plan.md`, the code and its tests, and a pull request with review findings. The chain is a real audit trail. It is also nearly invisible to the people who most need it:

1. **Product managers and leaders do not read Git.** The decisions that need them (accept this intent, approve this spec, merge this plan) sit in pull requests they never open.
2. **Each Claude surface holds one piece of the story.** Design happens in one place, specification in another, building in a third. Nobody sees the flow end to end.
3. **Plan and reality drift silently.** A plan says three subtasks and two ship. Nothing flags it until someone diffs the pull request by hand.
4. **Governance is by hope, not evidence.** Hooks, reviews and gates exist, but nobody can see whether they were used.
5. **Practitioners already track this by hand.** Spec files with hand-maintained statuses, README claims that nothing verifies. The need is real, and the workaround is manual.

## Proposed outcome

Chain is a **visual decision and transparency layer on top of GitHub**. A person connects a repository (and optionally other sources) and, within five minutes, can answer four questions without reading a diff:

- What are we trying to achieve? (capabilities, written as user goals)
- What is in flight, and how far along is each feature along the chain?
- Where is a human decision waiting right now, and for how long?
- Where did execution drift from the plan, and what is the evidence?

Chain does this by **reading** what teams already commit. It adds no new process to Product Management or Agile, and it does not ask teams to move their work out of their existing tools. It makes the intent of those practices visible, and it shows where they are bypassed.

**Where Chain sits.** Spec-driven tools such as Spec Kit, Kiro and OpenSpec help teams create the artifacts, and the dashboards found for them read local files only ([landscape](../../docs/landscape.md), with sources). Chain's ground is the **join**: artifact files, pull request state, review findings and drift signals in one read-only view that non-engineers can read.

Chain is built using its own chain. Its vision, spec and architecture decisions are the first artifacts in its repository, so the way it is built demonstrates what it is for.

## Principles

1. **Git is the system of record** for intent, spec and plan. Chain stores derived views, never the truth.
2. **Link, don't replace.** Jira, Linear and Azure DevOps keep stories, sprints and backlogs. Chain links to them by ID.
3. **Observe, don't modify.** Read-only toward repositories and PM tools in v1.
4. **Deterministic before intelligent.** Every status and drift signal is derived by rules that give the same answer for the same inputs. No AI inference in v1.
5. **Human gates are the product.** Chain's most important view is the one that shows where a person must decide.
6. **Transparent by construction.** Every Chain decision has an ADR before code. Every Chain feature travels the chain.
7. **Proportionate.** Small changes take a light path. A method that is too heavy gets skipped, and then nobody can see the work ([ADR-0011](../../docs/adr/0011-light-path-for-small-changes.md)).
8. **Evidence for claims.** Statements about other tools link to a source in the [landscape](../../docs/landscape.md).

## Users and systems concerned

| Who | What they need from Chain |
|---|---|
| Product builder (solo or small team) | See the flow from design to shipped, start the next Claude Code session with the right context |
| Product manager / product owner | See which intents and specs wait for acceptance, and whether execution matches the plan |
| Product leader | See capabilities and health across several products, in a form fit for a review meeting |
| Platform / engineering lead | Check that the harness (hooks, review policy, skills) is in place and used |

Systems: GitHub (repositories, pull requests, review findings), Claude Design, Claude.ai and Claude Code (as producers of artifacts and session activity), and Jira, Linear and Azure DevOps (as linked systems of work items).

## Capabilities

Capabilities are written as user goals. Progress is delivery-based in v1: a capability advances as its features ship.

| Slug | Capability | Persona |
|---|---|---|
| [`flow-visibility`](../../capabilities/flow-visibility.md) | Product builder can visualize the flow of work between Claude interfaces, from design to shipped | Builder |
| [`drift-prevention`](../../capabilities/drift-prevention.md) | Product builders and teams can follow the AI SDLC and avoid drift between vision and execution | Builder, PM |
| [`portfolio-vision`](../../capabilities/portfolio-vision.md) | Product leaders have a portfolio vision of all the features and outcomes from their AI-developed products | Leader |
| [`linked-work`](../../capabilities/linked-work.md) | Teams keep their existing PM tools and see their work items linked to intents, specs and plans | PM, Platform lead |
| [`build-transparency`](../../capabilities/build-transparency.md) | Product builder can see what Claude Code did on each feature without reading transcripts | Builder |

The first three come from the original product thesis. The last two were added when the scope was widened to PM-tool links and Claude Code session data. They are marked as proposed in the spec.

## Non-goals

- Not a backlog, sprint or story-board tool. No estimates, no velocity.
- Not a replacement for Jira, Linear or Azure DevOps.
- Does not write to repositories in v1. No commits, no PR comments.
- No AI-generated summaries or inferred drift in v1.
- No code-quality scoring and no static analysis. Chain reads process artifacts, not source code.
- Does not store prompts or session transcripts.
- Not a spec-authoring tool. Chain does not generate intents, specs or plans; other tools do that.

## Constraints

- Public showcase: the repository, specs and decisions are public. No secrets and no private organisation details in any committed file.
- Fully standalone: its own Supabase project, its own Vercel project, no shared infrastructure with any other product.
- Read-only access to GitHub through a GitHub App with the minimum permissions.
- Works with the conventions teams already follow, not with a format only Chain understands. Its own folder convention is the default; readers for other spec-driven layouts follow in 1.1 ([ADR-0012](../../docs/adr/0012-read-other-spec-layouts.md)).
- Accessible: status is never conveyed by colour alone.

## Open questions

- **Name.** "Chain" is a working name. It needs a trademark, domain and package-name check before the first public release.
- **Licence.** Not yet chosen. It must be decided before the repository is made public.
- **Claude Code session data.** Claude Code documents an OpenTelemetry export. A spike tests it first, with a hook as fallback, before the connector is committed to ([ADR-0006](../../docs/adr/0006-claude-code-sessions-via-hooks-metadata-only.md), status: proposed).
- **Other spec layouts.** Real output from Spec Kit, Kiro and OpenSpec must be inspected before readers are built ([ADR-0012](../../docs/adr/0012-read-other-spec-layouts.md), status: proposed).
- **Which trackers.** Copilot already posts progress into Jira and Linear. Whether Chain needs its own connectors for them is unproven; Azure DevOps is first.
- **Light-path thresholds.** Five files and 150 lines are placeholders, to be tuned on Chain's own pull requests.
- **Linking PRs to features.** The convention (paths touched, `Feature:` line, label) needs validation against real repositories.
- **Review-finding format.** Drift detection parses the pass tag in review findings. The tag format must be agreed in `REVIEW.md` and tested on real findings.

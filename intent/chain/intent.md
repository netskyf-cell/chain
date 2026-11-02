---
slug: chain
capability: all
produced_with: claude-code
---
# Intent: Chain

Author: Frédéric Gilbert (product builder).

> Product-level intent: **why** Chain exists and **what** it must achieve. **How** is in the [decision records](../../docs/adr/README.md) and, per feature, in `spec.md` and `plan.md`. This file has no Status line: its state comes from the pull request that merged it.

## Problem

AI has made writing code fast. The slow and risky parts are now human: deciding what to build, reviewing what was built, accepting it. And the trail between those moments is scattered.

In a typical enterprise team, one feature leaves traces in several tools that nobody reads together:

- the decision lives in a work-item tracker (Azure DevOps Epics, Features and stories, with acceptance criteria) or a wiki (Confluence PRDs and specs), sometimes in the repository;
- the code lives in a code host (GitHub, Azure DevOps Repos, GitLab), increasingly written by a coding agent.

Decisions and code then drift apart silently, in two ways:

1. **Traceability drift.** A story is closed with no code behind it. Code is merged with no decision behind it. An Epic stalls and nobody notices.
2. **Content drift.** The code exists and is linked, but does not do what the acceptance criteria say. Reviews look at code quality, rarely at the spec.

AI-assisted delivery makes both worse: more code, faster, from more documents (PRDs, specs, plans, agent tasks).

## Proposed outcome

**Chain shows product people whether what they decided is what got built.** A team installs Chain into its own coding agent and, in one sitting, gets a board that answers:

- What did we decide, and where does each decision stand?
- Which decisions have no code, and which code has no decision?
- Where does shipped code miss its acceptance criteria, with the evidence?
- What shipped without anyone checking it against the criteria?

Chain ships as an **agent pack**, not a hosted service: three agents, a few hooks, a rules engine and a local board ([ADR-0002](../../docs/adr/0002-local-first-agent-pack.md)).

| Part | Job | Judges? |
|---|---|---|
| Setup agent | Learns the team's tools and words once, writes `chain.yml` | No |
| Compliance review agent | Checks each PR against its acceptance criteria, posts tagged findings | Yes, inside the team's review |
| Collector agent | Gathers every source through the team's connectors into one observations file | No |
| Rules engine | Reads the observations file and decides drift, the same way every time | Rules, not AI |
| Board | A local web page that shows what the rules decided | No |

**Agents collect, rules decide** ([ADR-0001](../../docs/adr/0001-agents-collect-rules-decide.md)). The only AI judgement sits in the team's own review, written down where a person can see and dispute it.

**Chain tracks roles, not document types** ([ADR-0003](../../docs/adr/0003-role-model-and-observations-contract.md)). Every way of working passes through five roles: intent, specification, plan, change, outcome. Each team maps its own documents and words to those roles. When AI-assisted delivery adds new document types, teams map them; Chain does not change.

## Users

| Who | Their question | First thing they look at |
|---|---|---|
| Product owner / product manager (first user) | "Did what we agreed ship, and match the criteria?" | Drift and unverified items for their team |
| Product leader | "Which products are on track, where is a decision stuck?" | One page across teams |
| Engineering lead | "Is unplanned work slipping in? Do agents build what was asked?" | Change with no mandate |
| Platform lead | "Do teams have the setup that keeps AI work safe?" | Readiness per repository |
| Agile coach | "Is the way of working followed or bypassed?" | Evidence of skipped steps |

## Principles

1. **Read-only.** Chain never writes to a tracker, a wiki or a code host. The team's own review agent posts its findings, with the team's permissions.
2. **Link, don't replace.** Trackers keep backlogs, sprints and stories. Chain links to them by ID.
3. **Deterministic verdicts.** Every drift signal comes from a rule a person can read. Same inputs, same answer.
4. **Missing evidence is a finding.** A change nobody checked against its criteria is shown as unverified, never as on track.
5. **The team's words.** Chain shows Epic, initiative or capability as the team says it.
6. **Local-first.** Data stays on the team's machines and in its own tools.
7. **Agent-neutral.** Works with GitHub Copilot, Claude Code and other agents that read instruction files and use MCP connectors.
8. **Evidence for claims.** Statements about other tools link to a source in the [landscape](../../docs/landscape.md).

## Non-goals

- Not a backlog, sprint or estimation tool.
- Not a spec writer: Chain does not generate PRDs, specs or plans.
- Not a productivity or people score. No code-quality scoring outside the acceptance criteria.
- No AI-inferred drift in the rules engine.
- No hosted service, database or sign-in in the first release.
- No storage of prompts or session transcripts.

## What carries over from v1

The first prototype (repository `chain-v1`) proved the rules and the board, as a hosted service reading Chain's own repository. See [lessons from v1](../../docs/lessons-from-v1.md) for what is kept (drift rules, parsers, review-finding format, the board's look) and what is not (GitHub App, webhooks, database, hosting, sign-in).

## Proof of value

A spike on 2026-11-02 reviewed one merged v1 pull request against its 7 acceptance criteria: 5 met, 2 not met. Both gaps had passed review, 142 tests and a live run.

The first release is judged by a benchmark: 5 merged PRs from one team, with and without the compliance review agent. The product owner rates each finding as a real gap or noise. Proposed bar: at least 1 real gap per 5 PRs, under 30% noise.

## Open questions

1. **Observations contract.** The draft in [`docs/contract/`](../../docs/contract/README.md) must survive a real team's data. Which fields are missing?
2. **Connectors.** Which MCP connectors exist for Azure DevOps, Confluence and the code hosts teams use, and what can each read? A spike checks before the collector is specified.
3. **Where the board runs.** A local page opened from the observations file, or a page inside the coding agent's interface?
4. **Benchmark sample.** Which team, which 5 PRs, and who rates the findings?
5. **Name.** "Chain" is a working name.

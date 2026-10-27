# Chain

**A decision and transparency layer on top of GitHub for AI-native product development.**

When AI agents write the code, the work moves faster than the picture of it. Chain makes the artifact chain visible — intent → spec → plan → build → review — shows where a human decision is waiting, and flags where execution drifted from the plan. It reads your repository. It does not replace your PM tool, and it does not write to anything.

Spec-driven tools such as Spec Kit, Kiro and OpenSpec create the artifacts. Chain's ground is the **join**: artifact files, pull request state, review findings and drift signals in one read-only view. [What exists today, with sources](docs/landscape.md).

> Status: **vision and specification stage.** No application code yet. The product is built in the open, through the same chain it displays ([ADR-0010](docs/adr/0010-chain-is-built-with-its-own-chain.md)).

## Why

- Agents ship output. Nobody holds the whole picture: what was intended, what was planned, what was built, what is waiting on a person.
- Product Management and Agile practices still matter. They need new evidence, not a new tool. See [how each practice is kept](docs/agile-mapping.md).

## What it does

| Capability | A user can… | Release |
|---|---|---|
| [Flow visibility](capabilities/flow-visibility.md) | see a feature move from intent to shipped, and what is waiting on whom | 1.0 |
| [Drift prevention](capabilities/drift-prevention.md) | know when the build departs from the plan, with evidence | 1.0–1.1 |
| [Portfolio vision](capabilities/portfolio-vision.md) | see capabilities and outcomes across products | 1.0, then teams and orgs |
| [Linked work](capabilities/linked-work.md) | follow a feature into a PM tool, starting with Azure DevOps | 1.2 |
| [Build transparency](capabilities/build-transparency.md) | see how an agent-built change was made | 1.1 |

## How this repository demonstrates the approach

| Practice | Where to look |
|---|---|
| Intent before code | [`intent/chain/intent.md`](intent/chain/intent.md) |
| Proportionate process | [Light path, ADR-0011](docs/adr/0011-light-path-for-small-changes.md) |
| Claims with sources | [`docs/landscape.md`](docs/landscape.md) |
| How to build it | [`docs/implementation-guide.md`](docs/implementation-guide.md) |
| Testable spec | [`intent/chain/spec.md`](intent/chain/spec.md) |
| Decisions recorded | [`docs/adr/`](docs/adr/README.md) |
| Architecture | [`docs/architecture.md`](docs/architecture.md) |
| Agile intent kept | [`docs/agile-mapping.md`](docs/agile-mapping.md) |
| Review as a gate | [`REVIEW.md`](REVIEW.md), [PR template](.github/pull_request_template.md) |
| Guardrails | [`.claude/hooks/`](.claude/hooks), [`CLAUDE.md`](CLAUDE.md) |
| Acceptance | By merging a pull request, never by committing to the default branch |

## Repository map

```
capabilities/   user goals, one file each
intent/         intent/<slug>/{intent,spec,plan}.md per feature
docs/           architecture, Agile mapping, ADRs
design/         Claude Design export pointer and revision list
migrations/     SQL, applied by a person
templates/      files to copy into your own repository
.claude/        hooks and skills used to build Chain
public/ api/ lib/   application code (not yet created)
```

## Releases

| Release | Theme |
|---|---|
| 1.0 | Read the chain: GitHub files and PRs, flow view, waiting list, drift rules |
| 1.1 | See the build: coding-agent session metadata, readiness check, readers for other spec layouts |
| 1.2 | Link the work: Azure DevOps first; Jira and Linear if a need is confirmed |
| 2 | Teams |
| 3 | Organisations |

Start with [SETUP.md](SETUP.md) to run it, or the [spec](intent/chain/spec.md) to understand it.

## Credits

Built on ideas from Anthropic's AI-native SDLC playbook and on the MIT-licensed Thiga dojo conventions (`intent/<slug>/`, skills, acceptance by merge). Chain is an independent project and is not affiliated with either.

## Licence

[MIT](LICENSE).

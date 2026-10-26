# Landscape: what exists, as documented

Retrieved **2026-10-02**. Every row is a fact from a cited source. Where this document interprets, it says so and keeps the interpretation apart from the facts. Star counts and availability change.

## Documented facts

### Spec-driven development tools (they create the artifacts)

| Tool | Documented fact | Source |
|---|---|---|
| Spec Kit (GitHub) | Open source toolkit. Commands `/speckit-constitution`, `-specify`, `-plan`, `-tasks`, `-implement`, `-converge`. Files live under `.specify/`. The README page read has no mention of a dashboard or status tracking. | [github/spec-kit](https://github.com/github/spec-kit) |
| Kiro (AWS) | Specs are stored in `.kiro/specs/`, with requirements, design and tasks. Can create Jira epics and tasks from a spec and write the Jira keys back into the spec. The article gives no detail on live status sync. | [AWS Builder Center](https://builder.aws.com/content/38dEhy7nUpZcejXRAgc7lgIy8SI/building-enterprise-ready-software-with-kiro-and-jira-the-spec-driven-revolution) |
| OpenSpec | MIT licence. `specs/` holds requirements; `changes/` holds one folder per change with proposal, specs, design and tasks. Works with 30+ tools. | [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec/) |

Layouts differ between sources. The AWS article describes unified spec documents, and Böckeler's review (below) describes three markdown documents for Kiro. This is why spike S-F checks real output before any reader is built.

### Dashboards that already exist for those artifacts

| Tool | Documented fact | Source |
|---|---|---|
| openspec-ui | Kanban board across OpenSpec repos. Reads files from disk, read-only. No GitHub API and no PR or review features are mentioned. 28 stars, 4 forks, MIT. | [ToruAI/openspec-ui](https://github.com/ToruAI/openspec-ui) |
| openspec-mcp | Dashboard with an approval workflow (draft → pending_approval → approved → implementing → completed → archived). Works on local OpenSpec files. 31 stars, 5 forks, MIT. | [Lumiaqian/openspec-mcp](https://github.com/Lumiaqian/openspec-mcp) |

### PM tools and coding agents (they link issues to pull requests)

| Fact | Source |
|---|---|
| Copilot cloud agent for Linear is generally available (2026-07-23). Assigned a Linear issue, it opens a draft pull request and streams progress to the Linear activity timeline. | [GitHub changelog](https://github.blog/changelog/2026-07-23-copilot-cloud-agent-for-linear-is-now-generally-available/) |
| Copilot coding agent for Jira is in public preview (2026-03-05). It opens a draft pull request from a Jira issue and posts updates in Jira. Requires Jira Cloud with Rovo. | [GitHub changelog](https://github.blog/changelog/2026-03-05-github-copilot-coding-agent-for-jira-is-now-in-public-preview/) |
| Linear lists these agent integrations: Cursor, GitHub Copilot, Devin, Charlie, Cyrus (Claude Code powered), Sinatra. The page does not say what Linear shows about agent work. | [Linear](https://linear.app/integrations/agents) |

Azure DevOps was not covered by the searches behind this document.

### Engineering-intelligence platforms

| Fact | Source |
|---|---|
| DX, Jellyfish, Faros AI, LinearB and Swarmia are built around git activity, pull requests, sprints and delivery pipelines. The source says most platforms have limited AI ROI measurement. **The publisher sells a competing product**, so the framing is theirs. | [Larridin](https://larridin.com/blog/ai-productivity-measurement-platforms) |

### Claude Code telemetry

| Fact | Source |
|---|---|
| Claude Code exports OpenTelemetry metrics: session count, lines of code, pull request count, commit count, cost, token usage, edit-tool decisions, active time. | [Claude Code docs](https://code.claude.com/docs/en/monitoring-usage) |
| It exports events including hook registration and execution, skill activation and permission-mode changes. | same |
| Prompts, responses and tool content are redacted unless explicitly enabled by environment variables. Repository identity is included only when enabled. | same |

### Research on spec-driven development

| Fact | Source |
|---|---|
| Three levels: spec-first, spec-anchored, spec-as-source. All approaches reviewed are spec-first; not all aim higher. | [Böckeler, martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) |
| Spec-kit output was found "very verbose and tedious to review". | same |
| Agents frequently ignored or over-applied instructions in the tools reviewed. | same |
| Kiro produced four user stories and sixteen acceptance criteria for a small bug. | same |

### Playbook

Anthropic, *AI-Native SDLC playbook* (2026-08-21): artifact chain, human gates, hooks as approval gates, review passes, source of truth per artifact. (URL to be added.)

## What this document does not establish

- Not a market survey. Searches were limited to the tools named above.
- Absence of a feature on a page I read is not proof it is absent elsewhere.
- No competitor was installed or tested.
- No usage data. Stars are a rough signal of reach, nothing more.
- Azure DevOps, GitLab and other trackers or hosts were not checked.

## Interpretation (not fact)

Kept separate on purpose.

1. The artifact-creation layer is covered by others. The dashboards found read local files and do not show pull request state, review findings or drift. **Chain's ground is the join** of artifact files, pull request state, review findings and drift signals in one read-only view. This was not found in the sources read.
2. Heavy chains are a documented burden. Chain needs a proportionate path for small changes ([ADR-0011](adr/0011-light-path-for-small-changes.md)).
3. Layouts are fragmented across tools. Reading more than one layout widens the audience at modest cost ([ADR-0012](adr/0012-read-other-spec-layouts.md)).
4. Claude Code already documents a metadata-first export, so the first session-data spike tests it before a custom hook ([ADR-0006](adr/0006-claude-code-sessions-via-hooks-metadata-only.md)).
5. Copilot already posts progress into Jira and Linear. Chain's own connectors for them need a demonstrated need first (spike S-G). Azure DevOps comes first because it was not found covered.

## Keeping this current

Re-check the rows quarterly, or before any public claim about positioning. A claim in the README or on LinkedIn about what other tools do must link to a row here.

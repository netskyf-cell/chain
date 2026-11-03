# Chain

**Chain shows product people whether what they decided is what got built.**

Decisions live in trackers and wikis (Azure DevOps, Confluence) or in specs in the repository. Code lives on GitHub or Azure Repos, increasingly written by coding agents. Chain joins the two and shows where they drift apart:

- **Traceability drift:** stories closed with no code behind them, code merged with no decision behind it, criteria changed after shipping, Epics that stall.
- **Content drift:** code that does not meet its acceptance criteria, and code nobody checked against them.
- **Facts:** where each decision started, its path across tools, who built each change (a person, an agent, or both) and who checked it.

Think of a GPS for delivery: the route you agreed and where the code really is, on one screen.

## How it works

Chain is an agent pack you add to your own coding agent (GitHub Copilot or Claude Code). Nothing is hosted: no server, no database, no sign-in. Your data stays in your tools and on your machine.

| Part | What it does | Judges? |
|---|---|---|
| `chain-setup` agent | Learns where your decisions and code live and what you call things; writes `chain.yml` | No |
| `chain-compliance-review` agent | Checks a pull request against its acceptance criteria and, after you confirm, posts one comment of findings | Yes, inside your review |
| `chain-collector` agent | Reads every source through your agent's own connectors, read-only, into `chain/observations.json` | No |
| `chain rules` | Fixed rules decide what is drift, the same way every time | Rules, not AI |
| `chain board` | One HTML page, in your team's words, that opens from disk | No |

Agents collect, rules decide. The only AI judgement happens in your own review, where you can see and dispute it.

## Set it up in under an hour

You need: Node 20 or later, VS Code with GitHub Copilot (or Claude Code), and access to your team's tools.

### 1. Check your connectors (10 minutes)

The agents read your tools through MCP connectors, with your own access. Add the ones your team uses to `.vscode/mcp.json` (Copilot) or your Claude Code settings:

| Tool | Connector | Read-only setting |
|---|---|---|
| Azure DevOps (work items, Azure Repos) | Microsoft's [Azure DevOps MCP server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server): remote `https://mcp.dev.azure.com/<organization>` in VS Code, or the local `@azure-devops/mcp` | Header `X-MCP-Readonly: true` |
| Confluence (Cloud) | Atlassian's [Rovo MCP server](https://github.com/atlassian/atlassian-mcp-server) | Use only its read tools |
| GitHub | The [GitHub MCP server](https://github.com/github/github-mcp-server) | `--read-only` |

Two things only an admin can change, and that stop everything if they are off:

- **Copilot Business or Enterprise:** the organisation's "MCP servers in Copilot" policy must be enabled.
- **Atlassian:** your site must allow your AI tool in the Rovo MCP server settings.

See the [connector spike](docs/spikes/2026-11-02-connectors.md) for what each connector can read.

### 2. Install the pack (5 minutes)

In your team's repository:

```sh
npm install --save-dev github:netskyf-cell/chain
npx chain install --target copilot   # or: --target claude
```

This writes three files to `.github/agents/` (or `.claude/agents/`) and nothing else. Commit them in a pull request.

### 3. Run the setup agent (20 minutes)

In your coding agent's chat, pick the `chain-setup` agent and say: "Set Chain up for our team." It checks each connector, asks where your Epics, Features, stories and code live, finds your acceptance criteria, spots your coding agents, and writes `chain.yml`. Review it and merge it like any change.

### 4. Collect and open the board (15 minutes)

Pick the `chain-collector` agent and say: "Collect." It writes `chain/observations.json` and checks it. Then:

```sh
npx chain board
```

Open `chain/board.html` in your browser. It loads nothing from the network, so you can also attach it to an email.

### 5. Review a pull request against its criteria

On any pull request, pick the `chain-compliance-review` agent and say: "Review PR 123 against its criteria." It shows you one verdict per criterion and posts them only when you say so. The next collection picks them up.

## Commands

```sh
npx chain validate [chain/observations.json]      # check a collected file
npx chain validate --config [chain.yml]           # check the team configuration
npx chain compare a.json b.json                   # do two collections agree?
npx chain rules [file] [--out verdicts.json]      # the verdicts, as JSON
npx chain board [file] [--out chain/board.html]   # the board
npx chain install --target copilot|claude [--dir .] [--force]
```

`chain/observations.json` holds your team's work item titles, PR descriptions and review text. Decide with your team whether to commit it or add `chain/` to `.gitignore`.

## Try it on the example

```sh
git clone https://github.com/netskyf-cell/chain && cd chain && npm install
npx chain board examples/observations.example.json --config examples/chain.example.yml --out /tmp/board.html
```

## Status

First milestone, built: the observations contract, nine rules, the facts, the board, the three agents and install. Not yet proven on a real team: the agents' live runs and the [benchmark](docs/benchmark.md).

Read more: [intent](intent/chain/intent.md), [decision records](docs/adr/README.md), [observations contract](docs/contract/README.md), [signal catalogue](docs/contract/signals.md). The first prototype is archived as `chain-v1`; see [lessons from v1](docs/lessons-from-v1.md).

## Licence

[MIT](LICENSE).

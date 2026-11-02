# Chain

**Chain shows product people whether what they decided is what got built.**

Decisions live in trackers and wikis (Azure DevOps, Confluence, Jira) or in specs in the repository. Code lives on GitHub, Azure DevOps Repos or GitLab, increasingly written by coding agents. Chain joins the two and shows where they drift apart:

- **Traceability drift:** stories closed with no code behind them, code merged with no decision behind it, criteria changed after shipping, intents that stall.
- **Content drift:** code that does not meet its acceptance criteria, and code nobody checked against them.

## How it works

Chain is an agent pack you add to your own coding agent (GitHub Copilot, Claude Code). Nothing is hosted; your data stays in your tools.

1. **Setup agent:** learns where your decisions and code live and what you call things, and writes `chain.yml`.
2. **Compliance review agent:** checks each pull request against its acceptance criteria and writes findings in the review.
3. **Collector agent:** gathers everything through your agent's connectors into one observations file.
4. **Rules and board:** fixed rules decide what is drift, the same way every time; a local page shows it in your team's words.

Agents collect, rules decide. The only AI judgement happens in your own review, where you can see and dispute it.

## Status

Early. The intent, decisions and data contract are in review. Start with [`intent/chain/intent.md`](intent/chain/intent.md).

The first prototype is archived as `chain-v1`; see [lessons from v1](docs/lessons-from-v1.md).

## Licence

[MIT](LICENSE).

# design/

Visual reference for Chain, produced in Claude Design. It is a reference for look and behaviour, **not production code** (ADR-0009): the export runs on a React runtime loaded from a CDN, and the app is rebuilt in vanilla HTML/CSS/JS, taking only tokens and layout.

The working name in the export is a placeholder ("Specline"). The product name is an open decision.

## Revisions to request in the next design round

1. Show the **source surface** on each chain node (Claude.ai, Claude Code, Claude Design, human), with a confidence label.
2. Add a **Start session** action on a feature that hands context to Claude Code.
3. Portfolio view across **multiple products**, grouped by capability.
4. **New capability** modal.
5. Sign-in: GitHub App install flow, not OAuth scopes (ADR-0004).
6. **Non-colour cues** for status (icon or label), so state is readable without colour.
7. Check **light mode**: only dark was reviewed.

## Tokens

Copy the final tokens into `public/css/tokens.css` once the design is accepted.

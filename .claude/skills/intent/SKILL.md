---
name: intent
description: Start a new feature. Creates intent/<slug>/intent.md from a goal, linked to a capability. Use when the user says they want to build or change something and no intent exists yet.
---

# Write an intent

1. Ask for the **user goal** in one sentence ("user can …"). Name the capability it serves; read `capabilities/` to pick one, or propose a new one.
2. Choose a short kebab-case slug. Create `intent/<slug>/intent.md`.
3. Use this shape:

```markdown
---
slug: <slug>
capability: <capability-slug>
produced_with: claude-ai | claude-code | claude-design | human
---
# <Title>

## Problem
## Proposed outcome
## Non-goals
## Open questions
```

4. Never add a Status line. Status comes from pull request state (ADR-0003).
5. Work on branch `claude/intent-<slug>`, open a pull request. The product owner accepts it by merging.
6. Stop after the intent. Do not write the spec or plan until the intent is merged.

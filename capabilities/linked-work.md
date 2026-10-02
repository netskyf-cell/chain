---
slug: linked-work
statement: Teams keep their existing PM tools and see their work items linked to intents, specs and plans
owner: fgilbert
target: 2027-Q1
---

# Capability: linked-work

> Teams keep their existing PM tools and see their work items linked to intents, specs and plans.

**Proposed.** Added when the scope was widened to PM-tool links. Needs confirmation with real teams.

## Why this matters

Most teams already run Jira, Linear or Azure DevOps, and auditors and regulators already accept them. Chain adds a layer in GitHub without asking anyone to move. The playbook's minimum bar is a link in both directions: files carry the work-item ID, and the work item carries the commit.

## What done looks like (delivery-based, v1)

All features linked to this capability have shipped. Chain displays the work-item IDs found in artifacts, and in a later release reads their status and flags broken links.

## Features

F-40, F-41, F-42, F-43, F-44. See [`spec.md`](../intent/chain/spec.md).

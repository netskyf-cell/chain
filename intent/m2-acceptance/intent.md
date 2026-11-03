---
slug: m2-acceptance
capability: all
produced_with: claude-code
---
# Intent: ready to accept

Author: Frédéric Gilbert (product builder). Builds on the product intent [`intent/chain/intent.md`](../chain/intent.md) and the first milestone [`m1-agent-pack`](../m1-agent-pack/spec.md).

## Problem

The board shows where the chain from decision to code breaks. It does not say what to do about it, and it is built for monitoring, while a product owner's real decision happens at one moment: **accepting a Feature at sprint review**. Today they accept on trust ("the stories are Closed") or check by hand, criterion by criterion.

The board also speaks in rule names a product owner has to learn ("Out of order", "Moved goalposts"), counts symptoms instead of decisions ("20 signals"), and flags a declared divergence, which is a team being honest, as a warning.

Developers find out their code misses a criterion only after the PR is open, sometimes after the merge, when fixing costs most.

## Proposed outcome

**A product owner can tell, per Feature, whether it is ready to accept, and who must do what if it is not.** A developer can check their branch against the criteria before opening the pull request, privately.

| Who | Moment | What Chain gives them |
|---|---|---|
| Product owner (sponsor, first user) | Sprint review, before accepting | Each Feature: ready to accept, not ready, or not checked; and the next action with who owns it |
| Developer | Before opening a PR | A private pre-flight check of the branch against the story's criteria |

## Principles kept

Rules decide, deterministically (ADR-0001). Local-first, no server (ADR-0002). Read-only: Chain never accepts, rejects or edits a work item. No person names or scores: Chain judges work against criteria, never people.

## Evidence

- Owner review of the board, 2026-11-03: "quite dull", "what would a product owner do on Monday with this?"
- Owner decision, 2026-11-03: product owners are the pilot's sponsor; developers get a pre-flight check in the same pilot.
- The 2026-11-02 spike: the two gaps found by a criteria check had passed review and tests. Found before the PR, they would have cost minutes.

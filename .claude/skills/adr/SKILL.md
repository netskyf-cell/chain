---
name: adr
description: Record an architecture decision before writing code that depends on it. Use for choices that are hard to reverse: data model, auth, connectors, hosting, new dependencies.
---

# Write an ADR

1. Read `docs/adr/README.md` for the next number and `docs/adr/template.md` for the shape.
2. Create `docs/adr/NNNN-short-title.md`: Status, Date, Deciders, Related, Context, Decision, Consequences, Alternatives considered.
3. Status is `proposed` until a person accepts it by merging the pull request. If the decision depends on an unverified fact, say so and name the spike.
4. Add one row to the index in `docs/adr/README.md`.
5. If it replaces an older ADR, set the old one to `superseded by ADR-NNNN`. Never delete ADRs.

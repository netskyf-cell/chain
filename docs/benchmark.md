# Benchmark: does the compliance review find real gaps?

The first milestone is judged by one question: on a real team's merged pull requests, does the compliance review agent find gaps the team's own review missed, without drowning them in noise? ([intent](../intent/chain/intent.md), "Proof of value"; spec AC-X1, AC-X2.)

Think of a second opinion from a doctor: it is worth having only if it sometimes catches what the first missed, and rarely raises false alarms.

## Bar to pass

| Measure | Bar |
|---|---|
| Real gaps found | At least 1 across the 5 PRs |
| Noise | Under 30% of `Important` and `Block` findings rated noise |
| Board (AC-X2) | The product owner reads the board without help and names one decision they would act on |

## Method

1. **Pick the team and the product owner.** The product owner rates the findings; they know what was agreed.
2. **Pick 5 PRs**, merged in the last 60 days, each linked to a story or Feature that has written acceptance criteria. Prefer a mix: at least one written with a coding agent and one without. Do not pick PRs known to have problems.
3. **Baseline (without Chain).** For each PR, record what the team's own review said about the criteria: approved with no comment, comments, or changes requested.
4. **Run the review agent** on each PR with the `chain-compliance-review` agent, one PR per fresh session. Do not post: copy the proposed comment into the rating sheet.
5. **Rate each `Important` and `Block` finding**, product owner alone, before discussing with anyone:
   - **Real gap:** the criterion is not met, and the team would want to know.
   - **Already known:** a real gap the team had seen and accepted (counts as real, not new).
   - **Noise:** the criterion is met, or the finding misreads it.
6. **Collect and open the board** for the same team, and ask the product owner: "What on this page would you act on?"
7. **Record the results below**, without names of people or internal links.

## Rating sheet

| PR | Written by | Criteria | Team review said | Met | Important / Block | Real gap | Already known | Noise | Unverifiable |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |
| **Total** | | | | | | | | | |

Noise rate = Noise ÷ (Important + Block). Real gaps = Real gap + Already known.

## Results

Not run yet. Needs the pilot team (intent, open question 4).

## Reference point

On 2026-11-02 the method was tried on one merged PR of Chain's own first prototype: 7 criteria, 5 met, 2 real gaps (a delivery recorded before it was processed; a different 404 body), both missed by review, 142 tests and a live run. One PR from the tool's own author is not a benchmark; it is why the benchmark is worth running.

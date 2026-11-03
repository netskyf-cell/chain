# Demo: showing Chain in 15 minutes

A script for showing Chain to a product audience. Part 1 needs nothing but this repository; part 2 runs live on a real team.

```sh
npm install
npx chain board examples/demo/observations.json --config examples/demo/chain.yml --out demo-board.html
```

`demo-board.html` opens from disk with no network. The demo team, "Fleet Portal", is fictional: 4 Epics, 9 pull requests, two coding agents.

## Part 1: the board (5 minutes)

| Minute | Show | Say |
|---|---|---|
| 0 | The headline: "The chain breaks in 3 of 4 Epics." | Every Epic is a chain from decision to code. Chain shows where it breaks, from the team's own tools, with no one filling in a status. |
| 1 | **Route optimiser**: started in Confluence, then Azure DevOps, then GitHub; 100% of commits by agents | This started as a PRD page, was planned in Azure DevOps and built entirely by agents. Now look at the red. |
| 2 | Node gh:61, "Criterion not met" | The compliance review agent checked this PR against the Feature's criteria: the route ignores the 26 t weight limit. Click the evidence: it points to the line. |
| 3 | Node gh:61, "Agent Pull request, no person reviewed" | Copilot wrote it, a criteria review flagged it, and it was merged with no person reviewing it. |
| 3 | Node ado:410, "Moved goalposts" | AC-2 changed after the code shipped. The code was right against the old criteria; nobody re-checked. |
| 4 | **Fuel consumption reports**, "Intact" | This is what good looks like: every story has code, every PR was checked against its criteria and by a person. |
| 5 | "Who built it, and who checked it" | Two thirds of the commits came from agents. Half the merged PRs were reviewed by a person. That is the conversation to have. |

Close with: "Agents collect, rules decide. Every red mark comes from a fixed rule a person can read, and links to its evidence."

## Part 2: live on a real team (10 minutes)

Prepared before the session: Chain installed in the team's repository, `chain.yml` merged, one collection done.

1. Open the team's own board (`npx chain board`). Pick one red mark and click through to the evidence in Azure DevOps or GitHub.
2. Pick a merged PR that no one checked against its criteria. In VS Code, ask the `chain-compliance-review` agent: "Review PR 123 against its criteria." Show the verdicts, one per criterion. Post them.
3. Ask the `chain-collector` agent: "Collect." Run `npx chain board` again. The PR moves from "nobody checked it" to checked, or to a red "Criterion not met".

If the team's tools cannot be reached on the day, run Part 1 only. Do not fake Part 2.

## Questions people ask

| Question | Answer |
|---|---|
| Does Chain write to our tools? | No. The collector and setup agents read only. The review agent posts one comment, after you confirm. |
| Where does our data go? | Nowhere new. The agents use your own connectors and access; the board is a file on your machine. |
| Is the AI judging our teams? | The rules judge links and dates, the same way every time. The only AI judgement is the criteria review, posted in your own PR, where you can dispute it. No people scores. |
| What if we don't write acceptance criteria? | Chain shows those PRs as unverified. That is a finding, not a failure of the tool. |

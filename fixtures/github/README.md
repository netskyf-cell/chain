# Recorded GitHub responses

Used by `test/github.test.js` and `test/demo.test.js`, so tests never call GitHub.

| File | What it is |
|---|---|
| `commit.json` | `GET /repos/netskyf-cell/chain/commits/<sha>`, trimmed to `sha` and `commit.tree.sha` (author fields removed) |
| `tree.json` | `GET /repos/netskyf-cell/chain/git/trees/<tree-sha>?recursive=1`, trimmed to `sha`, `truncated` and each entry's `path` and `type` |
| `raw/` | The files `scan()` reads, as served by `raw.githubusercontent.com` at that commit |

Recorded on 2026-10-27 from commit `55ed57f`. Error cases (404 and rate limit) are built in the tests from GitHub's documented status codes and headers, not recorded.

To refresh after the convention or Chain's own artifacts change, re-run the recording commands in the S0 group B pull request.

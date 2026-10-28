# Recorded GitHub responses

Used by `test/github.test.js` and `test/demo.test.js`, so tests never call GitHub.

| File | What it is |
|---|---|
| `commit.json` | `GET /repos/netskyf-cell/chain/commits/<sha>`, trimmed to `sha` and `commit.tree.sha` (author fields removed) |
| `tree.json` | `GET /repos/netskyf-cell/chain/git/trees/<tree-sha>?recursive=1`, trimmed to `sha`, `truncated` and each entry's `path` and `type` |
| `raw/` | The files `scan()` reads, as served by `raw.githubusercontent.com` at that commit |
| `pulls/closed.json` | `GET pulls?state=closed`, trimmed; S2 adds `merge_commit_sha` (from `GET pulls/:n`) |
| `pulls/reviews/<n>.json` | `GET pulls/:n/reviews`, trimmed to `user.login`, `state`, `submitted_at`, `body`, `html_url` (S2) |
| `pulls/comments/<n>.json` | `GET pulls/:n/comments` (inline review comments), trimmed to `user.login`, `body`, `created_at`, `html_url` (S2) |
| `history/<path with / as __>.json` | `GET commits?path=<artifact>&since=2026-10-26T11:44:35Z&sha=cb65425`, trimmed to `sha`, `html_url`, `commit.committer.date` (no author names or emails) (S2) |
| `commit-pulls/<sha>.json` | `GET commits/:sha/pulls`, trimmed to `number`, `merged_at` (S2) |

Recorded on 2026-10-28 from commit `cb65425` (re-recorded in S1a so the tree and the pull requests match; S2 files recorded against the same commit). Every review and inline comment on PRs #1 to #13 has an empty body, so the compliance demo moment uses the drift fixture, not this recording. Error cases (404 and rate limit) are built in the tests from GitHub's documented status codes and headers, not recorded.

To refresh after the convention or Chain's own artifacts change, re-run the recording commands in the S0 group B pull request.

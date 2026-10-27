---
slug: s0-walking-skeleton
capability: flow-visibility
produced_with: claude-code
---
# Spec: S0 — Walking skeleton

Derived from [`intent.md`](intent.md). Features from the umbrella spec: F-04, F-03, F-10 and F-12, in static form (no pull request state).

## Decisions on the intent's open questions

| # | Question | Decision |
|---|---|---|
| 1 | Where GitHub calls run | A server-side function (`api/demo.js`) holds the read-only `GITHUB_DEMO_TOKEN`. A local development server runs the same function **without** a token, accepting GitHub's unauthenticated limit. The browser never calls GitHub and never sees a token. |
| 2 | Caching | In memory, per function instance, 5 minutes. This is an S0 interim: architecture §6.2 moves the demo cache to the database in S1. Reversible, so no ADR. |
| 3 | Fixtures | Hand-built repositories in `fixtures/`, in this repository. |

## Scope

In:

- Read a **public** repository's default branch: repository metadata, the file tree, `chain.yml` paths if present, and the frontmatter of `capabilities/*.md` and `intent/<slug>/intent.md`.
- Render a capability board and a feature chain from that data.

Out (later slices): pull request state and lifecycle (S1), signals (S2), sign-in and private repositories (S3), previews, source labels, design node, themes (S4).

## How it works

```
Browser  /#/demo?repo=owner/name
   │  fetch /api/demo?repo=owner/name
   ▼
api/demo.js ── cache hit? ──► JSON
   │ miss
   ▼
lib/connectors/github.js   2 REST calls: repo (default branch, head SHA), git tree (recursive)
                           + raw file reads (raw.githubusercontent.com, not counted in the REST limit)
   ▼
lib/parse/artifact.js      frontmatter only
   ▼
lib/scan.js                tree + frontmatter → { capabilities, features, unassigned }
```

`lib/scan.js` is pure: it takes the file list and file contents and returns the model. No network, no clock. This keeps the rule "connectors observe, one function decides" (ADR-0005) from day one.

## Acceptance criteria

Each criterion is checked by an automated test (T) or in a browser (B).

| ID | Criterion | Check |
|---|---|---|
| AC-1 | `parseFrontmatter(text)` returns the YAML fields between the first two `---` lines. A file with no frontmatter, or with malformed YAML, returns `{}` and does not throw. | T |
| AC-2 | `scan()` finds every `capabilities/*.md` and every `intent/<slug>/` folder, and for each folder reports `intent`, `spec` and `plan` as `present` (with path) or `absent`. | T |
| AC-3 | Paths come from `chain.yml` (`paths.capabilities`, `paths.intent`) when the file exists, with the defaults `capabilities` and `intent` otherwise. | T |
| AC-4 | A feature belongs to the capability named in its `intent.md` frontmatter `capability`. A missing or unknown value puts it in `unassigned`. | T |
| AC-5 | A capability's statement comes from its frontmatter `statement`; if absent, from its first `> ` quote line; if neither, it shows "No statement". | T |
| AC-6 | `GET /api/demo?repo=owner/name` returns `200` and the model as JSON for a public repository. | T (recorded responses) |
| AC-7 | Invalid `repo` format → `400`. Repository not found or private → `404` with a readable message. GitHub rate limit reached → `503` with "try again later". No response body and no log line contains a token. | T |
| AC-8 | A second identical request within 5 minutes makes **no** GitHub call. | T (injected fetch counter) |
| AC-9 | `/#/demo` shows a field to paste a repository URL or `owner/name`. Submitting it loads the board. | B |
| AC-10 | The board shows one card per capability with its statement and the list of its features, plus an "Unassigned" group when not empty. | B |
| AC-11 | `/#/feature/:repo/:slug` shows three nodes in order, intent → spec → plan. Each shows its file path in a monospace font, and `present` or `absent` as **text and icon**, never colour alone. | B |
| AC-12 | Every internal link starts with `/#/`. Reloading the page on any S0 route renders the same view. | T (link scan) + B |
| AC-13 | A repository that does not follow the convention renders with a message "No Chain artifacts found" instead of an error. | T (fixture) + B |
| AC-14 | `npm test` runs all tests with Node's built-in runner, with no network access. | T |
| AC-15 | A GitHub Actions workflow runs `npm test` on every pull request. | Visible on the PR |
| AC-16 | **Demo moment:** pasting `netskyf-cell/chain` shows Chain's five capabilities, and `s0-walking-skeleton` under `flow-visibility` with intent and spec present. | B |

## Data and routes

- **Data:** no database, no tables, no migration.
- **Routes:** `/#/demo` (F-04) and `/#/feature/:repo/:slug` (F-12), already listed in `CLAUDE.md`. In S0 the board is shown on `/#/demo?repo=owner/name`; `/#/` becomes the connected-repository board in S1. `:repo` is `owner/name`, URL-encoded.
- **Endpoint:** `GET /api/demo?repo=owner/name`.
- **Environment:** `GITHUB_DEMO_TOKEN`, optional locally, required on Vercel.

## Files

| Path | Role |
|---|---|
| `package.json` | `npm test`, `npm run dev`; one dependency at most (a YAML parser) |
| `lib/parse/artifact.js` | Frontmatter parser (AC-1) |
| `lib/scan.js` | Pure model builder (AC-2 to AC-5, AC-13) |
| `lib/connectors/github.js` | Read-only GitHub reads, with `fetch` injectable for tests |
| `api/demo.js` | Endpoint, validation, cache, error mapping (AC-6 to AC-8) |
| `dev-server.js` | Local server: serves `public/` and calls `api/demo.js` |
| `public/index.html`, `public/css/`, `public/js/router.js`, `public/js/views/{demo,board,feature}.js` | Front end (AC-9 to AC-12) |
| `fixtures/conventional/`, `fixtures/no-convention/`, `fixtures/github/` | Test repositories and recorded GitHub responses |
| `test/*.test.js` | Tests |
| `.github/workflows/ci.yml` | CI (AC-15) |

## ADR check

| ADR | Fit |
|---|---|
| 0001, 0003 | Reads the default branch; `present` / `absent` is an observed fact, not a stored status |
| 0002 | Reads `intent/<slug>/{intent,spec,plan}.md` and `capabilities/*.md` |
| 0004 | Demo token is the server-held, read-only, public-data token the ADR allows; no App yet |
| 0005 | Connector reads, `scan()` decides, pure and tested |
| 0009 | Vanilla HTML, CSS variables, ES modules, hash routing, Vercel function |
| 0013 | No agent or model is assumed anywhere |

No conflict. No new ADR needed.

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Unauthenticated local mode hits 60 calls per hour | Local testing blocked | Two REST calls per scan, raw file reads outside the REST limit, 5-minute cache |
| Large repositories return a truncated tree | Missing artifacts | Show a "tree truncated" notice; acceptable for a demo |
| Frontmatter conventions differ between repos | Wrong capability links | Unknown values go to "Unassigned", never guessed |
| No design tokens yet | Plain look | Minimal CSS variables in `public/css/tokens.css`, replaced when the design is accepted |

---
slug: s0-walking-skeleton
capability: flow-visibility
produced_with: claude-code
---
# Plan: S0 — Walking skeleton

Derived from [`spec.md`](spec.md). Three pull requests, one per step group. Each step starts with its test. The owner merges each PR before the next group starts.

## Technical choices (within ADR-0009)

| Choice | Value | Why |
|---|---|---|
| Runtime | Node 20 or later | Vercel default; `node:test` built in |
| Module format | CommonJS in `lib/`, `api/`, `test/`; ES modules in `public/js/` | Vercel functions in CommonJS (ADR-0009); the browser never imports `lib/` |
| YAML | `yaml` package, the only dependency | Frontmatter can hold nested maps (`links:`); a hand-written parser would be a bug source |
| HTTP in `lib/` | `fetch` passed in as an argument | Tests inject a fake that replays recorded responses and counts calls |
| Local server | `dev-server.js` on `node:http`, port 3000 | No Vercel CLI needed to develop |

## Group A — pure core (PR 1)

No network, no UI. At the end, `npm test` proves the model is right.

| Step | Do | Files | Verified by |
|---|---|---|---|
| A1 | Project setup: `package.json` with `test` (`node --test`) and `dev` scripts, `yaml` dependency, `.gitignore` (`node_modules`, `.env`), `.env.example` with `GITHUB_DEMO_TOKEN=` empty | `package.json`, `package-lock.json`, `.gitignore`, `.env.example` | `npm install` then `npm test` exits 0 with no tests |
| A2 | CI: run `npm ci` and `npm test` on every pull request, Node 20 | `.github/workflows/ci.yml` | The check appears and passes on PR 1 (AC-15) |
| A3 | Fixtures as plain data: `conventional` (3 capabilities, 4 features: full chain, intent only, unknown capability, no frontmatter; a `chain.yml` with custom paths in a second variant) and `no-convention` (README and source files only) | `fixtures/conventional/`, `fixtures/conventional-custom-paths/`, `fixtures/no-convention/` | Read by the tests in A4 and A5 |
| A4 | Test, then code: frontmatter parser | `test/artifact.test.js`, `lib/parse/artifact.js` | AC-1: valid, none, malformed, nested `links:` |
| A5 | Test, then code: `scan({ files, read })` builds `{ capabilities, features, unassigned, empty }` | `test/scan.test.js`, `lib/scan.js` | AC-2, AC-3, AC-4, AC-5, AC-13 against the fixtures, exact expected output |

## Group B — reading GitHub (PR 2)

At the end, `npm run dev` and `curl localhost:3000/api/demo?repo=netskyf-cell/chain` return Chain's own model.

| Step | Do | Files | Verified by |
|---|---|---|---|
| B1 | Record real GitHub responses for this repository once (repo, tree, three raw files) and a 404 and a 403 rate-limit case, with headers stripped of anything identifying | `fixtures/github/` | Files committed; no token or account data in them (secret-guard hook, manual read) |
| B2 | Test, then code: connector `readRepo(owner, name, { fetch, token })` → default branch, head SHA, file list, `truncated` flag, `read(path)` via raw URLs at that SHA | `test/github.test.js`, `lib/connectors/github.js` | Replayed responses; exactly 2 REST calls per scan; the token goes only in the `Authorization` header |
| B3 | Test, then code: endpoint `api/demo.js` — validates `repo` (`owner/name`, GitHub character rules), calls connector then `scan`, caches 5 minutes by `owner/name`, maps errors | `test/demo.test.js`, `api/demo.js`, `lib/cache.js` | AC-6, AC-7 (400, 404, 503, no token in body), AC-8 (second call within 5 minutes: zero fetches; time is injected, not read) |
| B4 | Local server: serves `public/` and routes `/api/demo` to the same handler; reads `GITHUB_DEMO_TOKEN` from the environment if set | `dev-server.js` | `npm run dev` then the `curl` above returns 200 and five capabilities |

## Group C — the views (PR 3)

At the end, the demo moment works in a browser.

| Step | Do | Files | Verified by |
|---|---|---|---|
| C1 | Shell: `index.html`, minimal tokens (CSS variables, dark default), router for `/#/demo` and `/#/feature/:repo/:slug`, unknown route → `/#/demo` | `public/index.html`, `public/css/tokens.css`, `public/css/app.css`, `public/js/router.js`, `public/js/api.js` | `test/links.test.js`: every `href` in `public/` starts with `/#/` (AC-12) |
| C2 | Demo view: input for a URL or `owner/name`, normalised to `owner/name`, loading and error states (400, 404, 503 messages from the API) | `public/js/views/demo.js` | Browser: valid, invalid, unknown repository (AC-9) |
| C3 | Board view on `/#/demo?repo=…`: one card per capability, statement, feature list with links; "Unassigned" group; "No Chain artifacts found"; "tree truncated" notice | `public/js/views/board.js` | Browser: Chain's repo and a repo without the convention (AC-10, AC-13) |
| C4 | Feature view: three nodes intent → spec → plan, path in monospace, `present` / `absent` as text and icon | `public/js/views/feature.js` | Browser (AC-11); reload on each route (AC-12) |
| C5 | Vercel config: static output from `public/`, function from `api/` | `vercel.json` | `npm test` still green; deploy is the owner's step (SETUP.md) |
| C6 | Demo moment and docs: run the full walk-through; update `SETUP.md` (local run, Vercel import, token creation) and the "Current sprint" line in `CLAUDE.md` | `SETUP.md`, `CLAUDE.md` | AC-16 with screenshots in the PR "Verification" section |

## For every pull request

- Run the `architecture-guard` skill before opening it.
- Fill **Plan match**, **Divergences from plan** (or "None") and **Verification** with evidence.
- Do not apply migrations, do not deploy (production-gate hook).

## Not in this plan

Pull request state, lifecycle, database cache, sign-in, previews, source labels, themes. They belong to S1 to S4.

## Divergences absorbed (after build)

What the build PRs did differently, now part of this plan. Each line names its PR.

| PR | Change accepted into the plan |
|---|---|
| #6 | `test/helpers.js` turns a fixture folder into the `{ files, read }` shape. The custom-paths fixture keeps a decoy `capabilities/ignored.md`. |
| #7 | Per-client rate limit, `lib/rate-limit.js`, 30 requests per minute (CLAUDE.md security rule). The connector reads `commits/HEAD`, which is still 2 REST calls. `test/fake-github.js` replays recorded responses. |
| #7, #9 | B4 and AC-16 were verified against recorded responses. The live check is still open: it needs the repository public and a token on the owner's machine or on Vercel (SETUP.md). |
| #9 | `public/js/dom.js` (text-only DOM), `public/js/main.js` (entry point), `public/package.json` (ES modules in Node tests). `vercel.json` is written but deployed by the owner. |

# Setup

Order follows the build slices. Do each step only when its slice starts.

## S0 — walking skeleton

**Run it locally**
1. Install Node 20 or later.
2. In the repository folder: `npm install`, then `npm test` (all tests run without network).
3. Optional: copy `.env.example` to `.env` and paste a demo token (step 5). Without it, GitHub allows 60 calls per hour from your address, enough to try it.
4. `npm run dev`, then open http://localhost:3000/#/demo and paste `netskyf-cell/chain`.

**GitHub call budget (S1a).** One scan reads the commit, the tree, two pull request lists, then each PR's files (and reviews for open PRs): about 4 + 2 × open PRs + merged PRs, at most about 90. Without a token (60 calls per hour) that is one scan per hour on an active repository, so set a token in `.env` for local work. Results are cached 5 minutes.

**Put it online (Vercel)**
5. **Demo token:** on GitHub, Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate. Repository access: *Public repositories (read-only)*. No permissions to add. Copy the token once; GitHub never shows it again.
6. On vercel.com, sign in with GitHub, **Add New → Project**, import `chain`. Vercel reads `vercel.json`: no build step, static files from `public/`, the function from `api/`.
7. In the project, **Settings → Environment Variables**: add `GITHUB_DEMO_TOKEN` with the token, for Production and Preview. Redeploy.
8. Open `https://<your-project>.vercel.app/#/demo`. Every merge to `main` redeploys automatically.

## S1 — state, queue and PR classification
1. **Supabase:** create a dedicated project. Run `migrations/001_initial_schema.sql` in the SQL editor (a person, not an agent).
2. **GitHub App** for your own repository (Settings → Developer settings → GitHub Apps → New):
   - Permissions: Contents (read), Pull requests (read), Metadata (read). Nothing else.
   - Subscribe to events: push, pull_request, pull_request_review.
   - Webhook URL: `https://<your-vercel-domain>/api/webhook`. Set a webhook secret.
3. **Vercel:** import the repository and set the environment variables below.

## S2 — drift
No new setup. Pure code and tests.

## S3 — sign-in and multi-repo
Sign-in with GitHub and install flow for other users. Spike S-B decides whether the App's user authorisation is enough.

## Environment variables

| Variable | Used by |
|---|---|
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | api/webhook (S1) |
| `GITHUB_DEMO_TOKEN` | api/demo (S0) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | api/ only |
| `SUPABASE_ANON_KEY` | front end (safe to expose) |

Never commit these. `.claude/hooks/secret-guard.sh` blocks it.

## 1.1 — session data and format readers
Session data: after spike S-A, set up the OpenTelemetry export (or the fallback hook from `templates/`) and the per-repository ingest token. Prompt and tool-content flags stay off.
Format readers: after spike S-F.

## 1.2 — PM tools
Each tracker gets its own read-only token and spike (ADR-0007).

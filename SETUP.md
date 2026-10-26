# Setup

Order follows the build slices. Do each step only when its slice starts.

## S0 — walking skeleton
1. Install Node 20+.
2. `npm install` (once `package.json` exists).
3. `npm test` runs the parser against `fixtures/`.
4. Open the app locally; it renders a fixture repository, then a public repository through the demo endpoint.
5. **Demo token:** create a fine-grained GitHub token with read-only access to public repositories only. Store it as `GITHUB_DEMO_TOKEN` in a local `.env` (never committed) and later on Vercel.

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

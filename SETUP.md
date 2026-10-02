# Setup

Order follows the build slices. Do each step only when its slice starts.

## S0 — walking skeleton (no accounts needed)
1. Install Node 20+.
2. `npm install` (once `package.json` exists).
3. `npm test` runs the parser and `reconcile` against `fixtures/`.
4. Open `public/index.html` in a browser; it renders this repository's own `intent/` from a local fixture.

## S1–S2 — state and drift
No new setup. Pure code and tests.

## S3 — connect GitHub
1. **Supabase:** create a dedicated project. Run `migrations/001_initial_schema.sql` in the SQL editor (a person, not an agent).
2. **GitHub App** (Settings → Developer settings → GitHub Apps → New):
   - Permissions: Contents (read), Pull requests (read), Metadata (read). Nothing else.
   - Subscribe to events: push, pull_request, pull_request_review.
   - Webhook URL: `https://<your-vercel-domain>/api/webhook`. Set a webhook secret.
3. **Demo token:** create a fine-grained token with read-only access to public repositories only. Store it as `GITHUB_DEMO_TOKEN` on the server.
4. **Vercel:** import the repository and set the environment variables below.

| Variable | Used by |
|---|---|
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | api/webhook |
| `GITHUB_DEMO_TOKEN` | api/demo |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | api/ only |
| `SUPABASE_ANON_KEY` | front end (safe to expose) |

Never commit these. `.claude/hooks/secret-guard.sh` blocks it.

## 1.1 — session data (after spike S-A)
Install the local hook from `templates/` and set the per-repository ingest token.

## 1.2 — PM tools
Each tracker gets its own read-only token and spike (ADR-0007).

# Setup

Order follows the build slices. Do each step only when its slice starts.

## S0 — walking skeleton

**Run it locally**
1. Install Node 20 or later.
2. In the repository folder: `npm install`, then `npm test` (all tests run without network).
3. Optional: copy `.env.example` to `.env` and paste a demo token (step 5). Without it, GitHub allows 60 calls per hour from your address, enough to try it.
4. `npm run dev`, then open http://localhost:3000/#/demo and paste `netskyf-cell/chain`.

**GitHub call budget (S2).** One scan reads:
- the commit and the tree, plus two pull request lists
- for each PR, its files, reviews and inline comments
- for each artifact on the default branch, its commit history and the PR behind each commit

That is about 4 + 3 × PRs + artifacts + artifact commits. Caps: 30 merged-PR reviews, 60 comment lists, 30 histories and 30 commit lookups. Chain's own repository needs about 60 calls; the worst case is about 270. Without a token (60 calls per hour) that is at most one scan per hour, so set a token in `.env` for local work. With a token you get 5,000 calls per hour. Results are cached 5 minutes. When a cap is hit, the board says "History partial".

**Put it online (Vercel)**
5. **Demo token:** on GitHub, Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate. Repository access: *Public repositories (read-only)*. No permissions to add. Copy the token once; GitHub never shows it again.
6. On vercel.com, sign in with GitHub, **Add New → Project**, import `chain`. Vercel reads `vercel.json`: no build step, static files from `public/`, the function from `api/`.
7. In the project, **Settings → Environment Variables**: add `GITHUB_DEMO_TOKEN` with the token, for Production and Preview. Redeploy.
8. Open `https://<your-project>.vercel.app/#/demo`. Every merge to `main` redeploys automatically.

## S1a — state, queue and PR classification
No new setup: S1a reads pull requests with the same demo token.

## S1b — database, GitHub App, webhooks

Do these once, in this order. Budget 30 to 45 minutes. Keep a text file open to paste the values marked **(save)**: you need them in step 4. Never paste them into a chat, an issue or the repository.

Before you start, Chain must be online on Vercel (S0 steps 5 to 8). The App needs its address. Below, `<vercel>` means your address, for example `chain-abc.vercel.app`.

### 1. Supabase project and database
1. On [supabase.com](https://supabase.com), sign in with GitHub, then **New project**. Name: `chain`. Choose a strong database password and a region close to you (for example *West EU*). Wait about 2 minutes for it to start.
2. Left menu, **SQL Editor**, then **New query**. Open `migrations/001_initial_schema.sql` from the repository on GitHub, click **Raw**, and copy all of it. Paste it into the editor and click **Run**. You should see "Success. No rows returned".
3. Check it worked. Run this second query; every row must show `true` in the last three columns (13 rows):
   ```sql
   select c.relname, c.relrowsecurity as rls,
     exists(select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'created_at') as created_at,
     exists(select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'updated_at') as updated_at
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by 1;
   ```
4. **Settings → API Keys.** Copy the **Project URL** **(save as SUPABASE_URL)** and create or copy a **secret key**, which starts with `sb_secret_` **(save as SUPABASE_SERVICE_ROLE_KEY)**. The secret key bypasses row-level security, so it lives only in Vercel, for `api/`. Do **not** copy the publishable key anywhere yet; S3 needs it.

### 2. GitHub App
1. On GitHub: your profile picture → **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Fill in:
   - **GitHub App name:** `Chain (netskyf)`. It must be unique on GitHub.
   - **Homepage URL:** `https://<vercel>`
   - **Callback URL:** leave empty for now (step 3 fills it).
   - Leave **Request user authorization (OAuth) during installation** unticked.
   - **Webhook → Active:** ticked. **Webhook URL:** `https://<vercel>/api/webhooks/github`
   - **Webhook secret:** make a long random string. One way: open a terminal and run `openssl rand -hex 32`. **(save as GITHUB_WEBHOOK_SECRET)**
3. **Permissions → Repository permissions.** Set exactly these to **Read-only** and leave everything else at *No access*:
   - Checks
   - Commit statuses
   - Contents
   - Metadata (already set, mandatory)
   - Pull requests
4. **Permissions → Account permissions:** **Email addresses → Read-only**. Only sign-in in S3 needs this (spike S-B).
5. **Subscribe to events:** Check run, Check suite, Pull request, Pull request review, Pull request review comment, Push, Status.
6. **Where can this GitHub App be installed?** *Only on this account.* Then **Create GitHub App**.
7. On the App's page:
   - Copy the **App ID** **(save as GITHUB_APP_ID)** and the **Client ID** (needed in step 3).
   - **Generate a new client secret** and copy it (needed in step 3).
   - Scroll to **Private keys → Generate a private key**: a `.pem` file downloads. Open it in a text editor and copy everything, including the `-----BEGIN` and `-----END` lines **(save as GITHUB_APP_PRIVATE_KEY)**. Then delete the downloaded file.
8. Left menu **Install App → Install** next to your account. Choose **Only select repositories → chain**, then **Install**.

### 3. Spike S-B check: sign-in with the same App (5 minutes)
This checks the desk result in ADR-0004 now, while the App is fresh. Chain does not use sign-in until S3.
1. Supabase: **Authentication → Sign In / Providers → GitHub → Enable**. Paste the App's **Client ID** and **client secret** from step 2.7. Copy the **Callback URL** Supabase shows, which ends in `/auth/v1/callback`, and save.
2. GitHub App settings (step 2): paste that URL into **Callback URL** and click **Save changes**.
3. In a browser, open `https://<your-project-ref>.supabase.co/auth/v1/authorize?provider=github`. The project ref is the first part of your Supabase URL. Approve on GitHub. Landing on a blank page or on localhost afterwards is expected.
4. Supabase: **Authentication → Users**. **Pass:** one user with your GitHub email. **Fail:** an error page, or a user with no email. Write the result in the Group 0 PR or tell Claude. Either way S1b continues: a failure only changes S3's sign-in plan.

### 4. Vercel environment variables
On vercel.com, open the `chain` project, then **Settings → Environment Variables**. Add each value saved above for **Production** and **Preview**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from step 1.4 |
| `SUPABASE_SERVICE_ROLE_KEY` | the `sb_secret_…` key from step 1.4 |
| `GITHUB_APP_ID` | App ID from step 2.7 |
| `GITHUB_APP_PRIVATE_KEY` | the whole `.pem` content from step 2.7, pasted as it is, on several lines |
| `GITHUB_WEBHOOK_SECRET` | the random string from step 2.2 |

Then **Deployments → … → Redeploy**. Until S1b Group B is merged, webhooks reach an address that does not exist yet and GitHub shows them as failed. That is expected and harmless.

### Check
GitHub App settings → **Advanced → Recent Deliveries** lists one delivery per event. Once deployed, they show `202`.

### If something is wrong
| You see | Likely cause | Fix |
|---|---|---|
| Deliveries show `401` | `GITHUB_WEBHOOK_SECRET` in Vercel differs from the App's webhook secret | Paste the same value in both, then redeploy |
| Deliveries show `503` | A variable is missing in Vercel | Check all 5 S1b variables, then redeploy |
| Deliveries show `500` | Database or App key problem | Vercel → project → **Logs**: the line names the kind (`store`, `app_auth`) |
| The board has no "Updated" label | The repository is not installed, or is private (served only after S3) | GitHub App → **Install App** → configure → add the repository |
| Deliveries show `202` but the board is old | The page was hidden (polling pauses) | Bring the tab to the front; it reloads at once |

## S2 — drift
No new setup. Pure code and tests.

## S3 — sign-in and multi-repo
Sign-in with GitHub and install flow for other users. Uses the same App (ADR-0004, spike S-B), checked in S1b step 3.

## Environment variables

| Variable | Used by |
|---|---|
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | `api/webhooks/github`, `api/state` (S1b) |
| `GITHUB_DEMO_TOKEN` | api/demo (S0) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a `sb_secret_` key) | api/ only (S1b) |
| `SUPABASE_ANON_KEY` (the publishable key) | front end, from S3 (safe to expose) |

Never commit these. `.claude/hooks/secret-guard.sh` blocks it.

## 1.1 — session data and format readers
Session data: after spike S-A, set up the OpenTelemetry export (or the fallback hook from `templates/`) and the per-repository ingest token. Prompt and tool-content flags stay off.
Format readers: after spike S-F.

## 1.2 — PM tools
Each tracker gets its own read-only token and spike (ADR-0007).

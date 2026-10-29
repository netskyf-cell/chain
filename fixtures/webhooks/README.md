# Webhook payloads

Hand-trimmed from the shapes in GitHub's webhook documentation ("Webhook events and payloads"). Each file keeps only the fields Chain reads, plus the identifiers GitHub always sends. Signatures are computed in the tests with a test secret. No real delivery and no personal data.

| File | Event (`X-GitHub-Event`) |
|---|---|
| `pull_request.closed.json` | `pull_request`, action `closed`, merged |
| `push.main.json` | `push` to the default branch |
| `push.branch.json` | `push` to another branch |
| `check_run.completed.json` | `check_run`, conclusion `failure` |
| `installation.created.json` | `installation`, action `created` |
| `installation_repositories.removed.json` | `installation_repositories`, action `removed` |

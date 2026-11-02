# Spike: which MCP connectors can feed the collector

Run **2026-11-02**, before the collector is specified ([intent](../../intent/chain/intent.md), open question 2). Sources: vendor documentation and the source code of the two open-source servers, read the same day. Nothing was run against a real organisation. Facts are kept apart from what we conclude.

Think of the collector as a clerk with a set of keys. This spike checks which doors each key opens, before we write the clerk's job description.

## Facts

### Azure DevOps (work items, ADO Repos, ADO Wiki)

| Fact | Source |
|---|---|
| Microsoft publishes two servers: a **remote** one at `mcp.dev.azure.com/{organization}` (public preview) and a **local** one, `@azure-devops/mcp` via `npx` (Node 20+). Microsoft recommends moving to the remote one and plans to archive the local repository once the remote one is generally available. | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server), [devblogs](https://devblogs.microsoft.com/devops/azure-devops-remote-mcp-server-public-preview) |
| The remote server signs in with Microsoft Entra ID only, needs an Entra-backed organisation, and supports Visual Studio Code (GitHub Copilot) and Visual Studio. Claude Code, Claude Desktop, Cursor and Codex need an OAuth client registered in Entra first; the local server (PAT or Entra) is the documented fallback for them. | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server) |
| Header `X-MCP-Readonly: true` exposes only read tools. `X-MCP-Toolsets` narrows to `repos`, `wit`, `wiki`, `pipelines`, `work`, `testplan`. The local server has `--read-only`-style domain filtering (`-d core work work-items repositories wiki`). | same |
| Work items: get one, get a batch by ids, list revisions, list comments, list backlog items, run a saved query, full-text search. WIQL queries are Insiders-only on the remote server. | same |
| `wit_get_work_item` accepts `expand: Relations`, which returns the work item's relations: parent and child links, and artifact links such as pull requests. Revisions accept the same `expand` and a field list. | [source: `src/tools/work-items.ts`](https://github.com/microsoft/azure-devops-mcp) |
| Pull requests (ADO Repos): get by id with `includeWorkItemRefs` and `includeChangedFiles` (file list of the latest iteration, no line diff); list by repository or project; list comment threads and their comments; read a file at a branch, tag or commit; search commits. | [source: `src/tools/repositories.ts`](https://github.com/microsoft/azure-devops-mcp) |
| Writing a PR comment thread (`repo_create_pull_request_thread`) is a write tool, hidden when read-only is on. | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server) |
| Azure DevOps Server (on-premises) is not supported, and Microsoft has no plan to support it. | [FAQ](https://github.com/microsoft/azure-devops-mcp/blob/main/docs/FAQ.md) |

### Confluence

| Fact | Source |
|---|---|
| Atlassian's official **Rovo MCP Server** is cloud-hosted, Atlassian Cloud only, signs in with OAuth 2.1 or an API token, and lists VS Code with GitHub Copilot and Claude Code among supported clients. | [atlassian/atlassian-mcp-server](https://github.com/atlassian/atlassian-mcp-server) |
| Confluence read tools: get a page (body as Markdown), get a page's descendants, get pages in a space, list spaces, CQL search, inline comments, plus a unified Rovo search and fetch. | [Atlassian Community](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/What-can-MCP-actually-do/ba-p/3164534) |
| Site admins control which external AI tools and domains may connect, in the Rovo MCP server settings in Atlassian Administration. Rate limits apply per site and plan. | [Glama listing of the official server](https://glama.ai/mcp/servers/wlv1y9unvv), [Atlassian](https://www.atlassian.com/platform/rovo-mcp) |
| For Confluence Server or Data Center, the common option is the community server `sooperset/mcp-atlassian` (MIT, Python, Docker or `uvx`, personal access token). Atlassian does not support it. | [sooperset/mcp-atlassian on Glama](https://glama.ai/mcp/servers/@sooperset/mcp-atlassian/tree) |

### GitHub

| Fact | Source |
|---|---|
| The GitHub MCP server's `pull_request_read` reads a PR, its diff, changed files, commits, reviews, review threads and comments. A `--read-only` flag keeps only read tools. | [github/github-mcp-server README](https://github.com/github/github-mcp-server) |

### GitHub Copilot policy

| Fact | Source |
|---|---|
| For Copilot Business and Enterprise seats, the **"MCP servers in Copilot"** policy must be enabled to use any MCP server. When disabled, no MCP server can be used by anyone holding a seat from that organisation or enterprise. | [GitHub docs](https://github.com/github/docs/pull/40973/files) |
| Copilot cloud agent and third-party MCP servers are disabled by default for members with Business or Enterprise seats. | [GitHub docs](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-organization/add-copilot-cloud-agent) |

## What this means for Chain (interpretation)

| Contract need | Azure DevOps | Confluence (Cloud) | GitHub |
|---|---|---|---|
| Items, titles, states, URLs | Yes | Yes (pages) | Yes |
| Parent links (story → Feature → Epic) | Yes, relations | Page tree (descendants) | n/a |
| Change → decision links | Yes: PR work-item refs, work-item artifact links | n/a | `AB#123` in PR text; native links live on the ADO side |
| Criteria text | Yes, a field | Yes, page body | n/a |
| `criteria[].changedAt` | Yes, from revisions | Not confirmed: no version-history tool found | n/a |
| Review findings | Yes, PR threads | n/a | Yes, reviews and review threads |
| Code to review | Changed files and file content, no diff | n/a | Diff |

1. **The keys exist for the first user's stack**, if the organisation's Azure DevOps is Entra-backed and its Confluence is Cloud. Both are unconfirmed and are the first pilot questions.
2. **The biggest risk is policy, not technology.** If "MCP servers in Copilot" is off, or Atlassian admins have not allowed VS Code, nothing reads anything. Setup must check this first and say so plainly.
3. **The collector can be read-only by configuration**, not just by promise: the ADO read-only header and GitHub `--read-only` flag. The compliance review agent is the one part that writes (one PR comment, ADR-0001), so it needs its own, narrower write permission.
4. **The review agent should read the diff from local git**, not from the connector. ADO's connector gives a file list without a diff; every team has the branch checked out. Connectors are then needed only to find the criteria and to post the comment.
5. **Contract open question 1 is answered for ADO:** revisions make `changedAt` possible, at one extra call per item that holds criteria. For Confluence it stays `null` until a version source is found.
6. **On-premises tools are out of the first milestone.** ADO Server has no supported server; Confluence Data Center needs a community server that may not pass a security review.

## Not checked

- A live run against a real organisation (needs the pilot team's access).
- Rate limits at the volumes a team generates (a few hundred work items, tens of PRs).
- Whether Confluence page metadata from `getConfluencePage` includes a version number or last-modified date.

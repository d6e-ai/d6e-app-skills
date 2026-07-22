# Developing d6e Plugins with a Local AI Agent

日本語版: [local-ai-development.ja.md](./local-ai-development.ja.md)

This guide explains how to develop and test d6e Plugins from a **local
AI coding agent** — Codex CLI, Claude Code, Cursor, or any agent that
can run shell commands and/or connect to MCP servers — against a **live
d6e instance**, without deploying anything until the very end.

The core fact that makes this work: **everything the d6e AI agent can do
is exposed as public HTTP APIs on the instance**. The chat agent inside
d6e talks to the same MCP server and the same REST API that you can call
from your laptop. There is no capability that exists only "inside" d6e.

```
┌────────────────────┐        ┌────────────────────────────────────┐
│ Local AI agent      │        │ d6e instance (e.g. https://…)      │
│ (Codex / Claude     │  MCP   │  ┌──────────┐   ┌──────────────┐  │
│  Code / Cursor)     │───────▶│  │ MCP :8081│──▶│ Rust API      │  │
│                     │  REST  │  └──────────┘   │  /api/v1/*    │  │
│  local Docker for   │───────▶│                 │  SQL / STF /  │  │
│  Docker-STF dev     │        │                 │  Drive / SaaS │  │
└────────────────────┘        │                 └──────┬───────┘  │
                               │            PostgreSQL ◀┘          │
                               └────────────────────────────────────┘
```

| What you want to test | Where it runs | How |
|---|---|---|
| Workspace SQL (tables, queries) | Remote (real DB) | `POST /api/v1/workspaces/{id}/sql` or MCP `d6e_sql` |
| QuickJS (`runtime: js`) STF logic | Remote (real QuickJS runtime) | `POST /api/v1/stfs/instant-run` or MCP `d6e_instant_run_stf` |
| Docker STF logic | **Local** `docker run` | stdin/stdout JSON contract; point `api_url` at the real instance for integration |
| Google Drive files | Remote (synced mirror) | `SELECT * FROM drive_files` + `d6e_read_drive_file` |
| SaaS calls (freee, Google Workspace, …) | Remote (server-held credentials) | `POST /api/v1/saas-proxy` or MCP `d6e_call_external_api` |
| Workflows | Remote | `POST /api/v1/workflows/{id}/execute` or MCP `d6e_execute_workflow` |
| Template prompt behaviour | Local agent ≈ d6e chat | see [Behaviour parity](#behaviour-parity-with-the-d6e-chat-agent) |

Placeholders used throughout:

- `D6E_BASE_URL` — your instance, e.g. `https://cauchye.d6e.ai`
- `WORKSPACE_ID` — UUID from the workspace settings page (`${D6E_BASE_URL}/{locale}/workspaces/{id}/settings`)

Account-level operations (login, redirect URI registration) happen on
the central d6e site, [https://www.d6e.ai](https://www.d6e.ai) — there
is no other value for it.

## Scope: this guide is about Plugins, not custom frontends

d6e can be extended on two sides of the same API line, and this guide
covers only the first:

- A **Plugin** packages *workspace contents* — `template_prompt`,
  tables/policies, STFs, workflows, effects — into a `template.yaml`
  that is installed **into** the instance and executed **by** the
  instance. Users interact with it through the built-in d6e console and
  chat. That is what the rest of this document develops and tests.
- A **custom frontend** is a separately deployed web app (your own
  domain and hosting) that signs users in via
  [https://www.d6e.ai](https://www.d6e.ai) and drives a workspace
  through the instance's public APIs — the same APIs used below. It is
  not installed into d6e and typically *consumes* what a Plugin
  provisions.

If you are building the latter, or are unsure how the frontend, the
instance, and the central account site relate, read
[Custom Frontends and the d6e Instance](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/docs/frontend-and-instance.md)
in the d6e-custom-frontend-skills repository first, then come back here
for the workspace side.

---

## 1. Get an API key (one-time, ~1 minute)

All `/api/v1/*` endpoints accept `Authorization: Bearer <token>`. For
local development you want a long-lived **API key** (`d6e_…`), created
in the d6e console:

1. Log in to the console (`${D6E_BASE_URL}`).
2. Click your avatar in the header → **API Keys**
   (`/{locale}/user/api-keys`). The same page is linked from the
   workspace settings page's Integration section, next to the client ID
   and workspace ID.
3. Create a key and copy the `d6e_…` value — it is shown only once.
   The expiry date is optional; omit it for a non-expiring key.

API keys belong to your user account (not to a workspace) and inherit
your workspace memberships. Use the key as
`Authorization: Bearer d6e_…` everywhere below, plus
`X-Workspace-ID: ${WORKSPACE_ID}` on workspace-scoped endpoints.

Sanity check:

```bash
curl -s ${D6E_BASE_URL}/api/v1/workspaces -H "Authorization: Bearer ${D6E_API_KEY}"
```

---

## 2. Connect your agent to the instance MCP server (recommended)

The instance runs the d6e MCP server in HTTP mode (default port **8081**,
path `/mcp`). This is *the same server, with the same ~90 `d6e_*` tools,
that the d6e chat agent uses* — connecting your local agent to it gives
you tool-for-tool parity with the hosted agent: `d6e_sql`,
`d6e_list_files`, `d6e_search_files`, `d6e_read_drive_file`,
`d6e_call_external_api`, `d6e_instant_run_stf`, `d6e_execute_workflow`,
`d6e_create_stf`, and so on.

> Note: on current deployments port 8081 is plain HTTP (the reverse proxy
> only fronts the console and `/api/v1`). Treat the API key accordingly,
> or tunnel via SSH if that is a concern for your instance.

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.d6e]
url = "http://<instance-host>:8081/mcp"
# Reads the key from the environment so it never sits in the config file:
bearer_token_env_var = "D6E_API_KEY"
# ...or inline (config file permissions apply):
# http_headers = { "Authorization" = "Bearer d6e_YOUR_API_KEY" }
```

**Claude Code**:

```bash
claude mcp add --transport http d6e http://<instance-host>:8081/mcp \
  --header "Authorization: Bearer d6e_YOUR_API_KEY"
```

**Cursor** (`.cursor/mcp.json` in the project, or global):

```json
{
  "mcpServers": {
    "d6e": {
      "url": "http://<instance-host>:8081/mcp",
      "headers": { "Authorization": "Bearer d6e_YOUR_API_KEY" }
    }
  }
}
```

After connecting, the agent should call `d6e_list_workspaces` once, then
`d6e_set_workspace` (or pass `workspace_id` per call) before using
workspace-scoped tools.

If you prefer not to use MCP, everything below shows the raw REST
equivalent — `curl` works just as well.

---

## 3. Workspace SQL

The workspace database is remote; there is nothing to reproduce locally.

```bash
curl -s -X POST ${D6E_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/sql \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "X-Workspace-ID: ${WORKSPACE_ID}" \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT id, status FROM my_table LIMIT 10"}'
# -> { "rows": [...], "executed_sql": "SELECT ... FROM user_data.ws_<uuid>_my_table ..." }
```

Bare table names resolve to the workspace's prefixed tables
(`user_data.ws_<uuid-with-underscores>_<name>`), exactly as they do for
the d6e agent. To list a workspace's tables:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'user_data'
  AND table_name LIKE 'ws_<workspace-uuid-with-underscores>_%';
```

**Policies apply to you exactly as they apply to the d6e agent.** Table
access is deny-by-default: a `POLICY_DENIED` / "No policy found for
Select operation on table '…'" error means the workspace has no allow
policy for that table and subject yet — create one in the console
(管理 → ポリシー) or via `d6e_create_policy` / `d6e_create_policy_group`,
or ship it in `template.yaml`'s `policies:` section. DDL
(`CREATE TABLE` etc.) is additionally gated by the workspace's DDL
policy-group setting.

---

## 4. Google Drive files — `ls`-equivalent exploration

When Drive sync is enabled on the workspace (Console → Files page →
Drive tab, or `PUT /api/v1/drive-sync/config` + `POST /roots` — requires
a `google_workspace` SaaS connection), the instance keeps a **projection
table `drive_files`** up to date with the full file listing: path, name,
MIME type, size, modified time, and `drive_id`. Exploring files is
therefore just SQL — no Drive API, no OAuth on your side (as with any
table, a select-allow policy for `drive_files` must exist in the
workspace):

```sql
-- "ls -R" equivalent
SELECT path, mime_type, size FROM drive_files ORDER BY path LIMIT 100;

-- find files like `ls | grep`
SELECT drive_id, path FROM drive_files WHERE path ILIKE '%2026-06%領収書%';
```

Reading file *content* is on-demand and cached server-side:

```bash
# MCP: d6e_read_drive_file { "drive_id": "..." }
curl -s -X POST ${D6E_BASE_URL}/api/v1/drive-sync/read \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{\"workspace_id\":\"${WORKSPACE_ID}\",\"drive_id\":\"<drive_id from drive_files>\"}"
# -> { "storage_file_id": "...", ... }  → download / extract text via storage-file APIs
```

Repeated reads of an unchanged Drive file hit the cache. Text extraction
(`d6e_extract_file_text`) and image viewing (`d6e_view_image`) accept the
resulting storage file ID.

Everything in this section works over MCP as well as REST: exploring is
`d6e_sql` on `drive_files`, reading is `d6e_read_drive_file`, and files
*outside* the synced roots can be fetched with
`d6e_download_external_file` / `d6e_call_external_api`. The one
exception is the initial Drive-sync **configuration** above
(`drive-sync/config` / `roots`): it has no MCP tool — like connecting
the SaaS credential itself, it is a one-time operator step done in the
console (or via REST).

---

## 5. SaaS APIs (freee, Google Workspace, …) without holding tokens

SaaS credentials (OAuth connections to freee, Google Workspace, Chatwork,
Notion, GitHub, Salesforce, Box, Money Forward, Zendesk) are configured
**once, in the d6e console** by a workspace member, and stored encrypted
server-side. Your local agent never sees the tokens — it calls the proxy
and the instance injects auth and handles refresh:

```bash
# freee: list companies (MCP: d6e_call_external_api)
curl -s -X POST ${D6E_BASE_URL}/api/v1/saas-proxy \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"workspace_id\": \"${WORKSPACE_ID}\",
    \"provider\": \"freee\",
    \"method\": \"GET\",
    \"path\": \"/api/1/companies\"
  }"

# freee: create a journal entry (POST with body)
curl -s -X POST ${D6E_BASE_URL}/api/v1/saas-proxy \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"workspace_id\": \"${WORKSPACE_ID}\",
    \"provider\": \"freee\",
    \"method\": \"POST\",
    \"path\": \"/api/1/manual_journals\",
    \"body\": { \"company_id\": 123, \"...\": \"...\" }
  }"
```

Notes:

- `path` is relative to the provider's API base
  (freee → `https://api.freee.co.jp`, google_workspace →
  `https://www.googleapis.com`, …).
- `Authorization` / cookie headers in the request are ignored — the proxy
  sets them from stored credentials.
- Binary uploads: pass `file_id` (a workspace storage file UUID) —
  alone for a raw binary body, together with `body` for
  multipart/related (e.g. Google Drive upload with metadata).
- Binary downloads: `POST /api/v1/saas-proxy-download` with the same
  shape saves the response into workspace storage.
- If a call fails with a credential error, connect / reconnect the
  provider in the console first (Console → 管理 → SaaS連携); that is the
  only step that must happen in the UI.

---

## 6. QuickJS STFs — run remotely, don't emulate locally

`runtime: js` STFs execute in an embedded **QuickJS** runtime inside the
instance, not Node. Emulating it locally is possible but subtly wrong;
prefer **instant-run**, which executes your code in the real runtime with
real workspace data, without saving anything:

```bash
# my-stf.js — script style, NOT a module:
#   const { date_from } = $input;            // $input global = the "input" field below
#   const rows = sql("SELECT count(*) AS n FROM expenses WHERE date >= '" + date_from + "'");
#   return { count: rows[0].n };              // top-level return = step output
# (`export` / `module.exports` fail — the runtime wraps the file in an async IIFE)

CODE_B64=$(base64 -w0 my-stf.js)
curl -s -X POST ${D6E_BASE_URL}/api/v1/stfs/instant-run \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "X-Workspace-ID: ${WORKSPACE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"runtime\": \"js\",
    \"code\": \"${CODE_B64}\",
    \"input\": { \"date_from\": \"2026-06-01\" },
    \"sources\": {}
  }"
# -> { "success": true, "output": ... }
```

(Full code-style rules: "JS STF Code Style" in
[the d6e-plugin-development skill](../skills/d6e-plugin-development/SKILL.md).)

MCP equivalent: `d6e_instant_run_stf` (also accepts `stf_id` /
`stf_version_id` to re-run a saved STF).

The edit-run loop is: edit `my-stf.js` locally → instant-run → read
output/error → repeat. Once green, save it with `d6e_create_stf` /
`POST /api/v1/stfs` or ship it in `template.yaml`.

Runtime environment (differences from Node to keep in mind):

- **No network**: `fetch` does not exist. External calls belong in
  effects / the SaaS proxy, orchestrated by a workflow — not inside a
  JS STF.
- **`sql(query)` global**: synchronous SQL against the workspace DB.
  Returns the row array directly for SELECT (`const rows = sql("SELECT …")`)
  and the affected-row count for INSERT/UPDATE/DELETE; throws on error.
- **`$sources` global**: outputs of upstream workflow steps, keyed by
  step name (also passed as the `sources` field in instant-run).
- **Libraries**: only bundled ones, imported as `@d6e-ai/<name>` —
  `crypto-js`, `docx`, `fontkit`, `pdf-lib`, `pptxgenjs`, `xlsx`, plus
  bundled Japanese fonts (e.g. `@d6e-ai/mplus-1p-regular`). `npm install`
  is not a thing here. (`d6e_list_stf_libraries` shows the live list.)
- Standard globals like `TextEncoder`/`TextDecoder`/`atob`/`btoa` are
  polyfilled; there is no `process`, `fs`, or `require`.

---

## 7. Docker STFs — the one thing you do run locally

Docker STFs are plain container images that read one JSON object on
stdin and write one JSON object to stdout, so the **local `docker run`
loop is a faithful reproduction** of production:

```bash
docker build -t my-stf:dev .

echo '{
  "workspace_id": "'"${WORKSPACE_ID}"'",
  "stf_id": "00000000-0000-0000-0000-000000000000",
  "caller": null,
  "api_url": "'"${D6E_BASE_URL}"'",
  "api_token": "'"${D6E_API_KEY}"'",
  "input": { "operation": "check", "period": "2026-06" },
  "sources": {}
}' | docker run -i --rm my-stf:dev
```

- For pure-logic tests, point `api_url` at a mock or leave the container
  offline.
- For **integration tests, point `api_url`/`api_token` at the real
  instance** — the container can then call `POST /api/v1/workspaces/{id}/sql`
  etc. exactly as it will when the instance launches it.
- One policy nuance: in production the instance injects a short-lived
  container token and SQL policies are evaluated for the **STF** as
  subject; with your API key they are evaluated for **you (the user)**.
  Grant the workspace's policy group both the user and (once registered)
  the STF, and the two runs behave identically.
- Implement the `{"operation": "describe"}` convention so
  `d6e_describe_stf` can report your input schema.
- Publish multi-arch (amd64 + arm64) images to a registry the instance
  can pull from before wiring the STF into a workflow. See the
  [d6e-docker-stf-skills](https://github.com/d6e-ai/d6e-docker-stf-skills)
  repository for the full development / testing / publishing guides.

---

## 8. Workflows

Workflows (input → STF steps → effect steps) always execute on the
instance. From your local agent:

```bash
# The request body IS the workflow input (no wrapper object)
curl -s -X POST ${D6E_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}/execute \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "X-Workspace-ID: ${WORKSPACE_ID}" \
  -H 'Content-Type: application/json' \
  -d '{ "period": "2026-06" }'
```

MCP: `d6e_execute_workflow`. Create/update them with
`d6e_create_workflow` / `d6e_update_workflow` during experimentation; the
final definitions go into `template.yaml`'s `workflows:` section.

---

## 9. Behaviour parity with the d6e chat agent

How close is "my local agent + instance MCP" to "the d6e chat agent"?

**Identical:**

- Tool surface: both talk to the same MCP server and the same tools hit
  the same REST endpoints with the same policy checks and audit logging.
- Data: same workspace DB, same Drive mirror, same SaaS credentials,
  same STF runtimes.

**Different (by design, and usually negligible):**

- **System prompt.** The d6e agent's context is assembled from the
  workspace: installed plugins' `template_prompt` (as
  `## PLUGIN: namespace/name@version` sections), workspace prompt rules,
  and product instructions. Your local agent has its own vendor prompt
  and your local rules instead.
- **Model.** d6e chat uses the workspace's configured model; your local
  agent uses its own subscription's model.

To make local experiments representative of the deployed plugin, paste
the draft `template_prompt` into your agent's project rules
(`AGENTS.md` / `CLAUDE.md` / `.cursor/rules/`) while iterating. Then the
remaining delta is vendor-prompt flavour, which does not affect tool
behaviour — only phrasing and planning style.

**Recommended workflow: develop the `template_prompt` and the resources
together.** When the agent misuses a tool or misreads a table, fix the
prompt text locally, re-test, and only then bake it into `template.yaml`.

---

## 10. From experiment to published Plugin

Once the pieces work from your local agent, the path to release is:

### 10-a. Package and install the plugin

1. Collect resources into a `template.yaml` (see
   [the d6e-plugin-development skill](../skills/d6e-plugin-development/SKILL.md)
   and [template-yaml-spec.md](./template-yaml-spec.md)):
   `template_prompt`, `stfs` (inline JS or Docker image refs), `files`,
   `effects`, `workflows`.
2. Push the repository — **GitHub or GitLab both work** — with
   `template.yaml` at the root. Install from URL rewrites web URLs to
   raw/API URLs automatically, so pasting the repository URL is enough.
   For a **private repository**, you will also be asked for a personal
   access token (PAT) with read access when installing.
3. Install into a test workspace: Console → プラグイン → **Install from
   URL** — the recommended path for development and team-internal
   plugins. Re-run it after each push to update resources in place.
4. Verify in the d6e chat UI (this is the step that exercises the real
   system prompt assembly).

### 10-b. If the plugin has a custom frontend

A plugin can come with a dedicated frontend (its own web app calling the
instance's APIs — see
[d6e-custom-frontend-skills](https://github.com/d6e-ai/d6e-custom-frontend-skills)
for the auth / session / proxy patterns, and
[frontend-and-instance.md](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/docs/frontend-and-instance.md)
for how the frontend, instance, and central account site relate). That
adds these release steps:

5. Build the frontend against the live instance. During development,
   OAuth2 login with **loopback redirect URIs** (`localhost`,
   `127.0.0.0/8`, `[::1]` — any port, any path) works without any
   registration (d6e ≥ v0.20.1).
6. Deploy the frontend, then register its **deployed** redirect URI
   (e.g. `https://your-app.example.com/auth/callback`) in **both**
   places:
   - **[https://www.d6e.ai](https://www.d6e.ai)** (the central d6e
     account site): self-service for franchise owners/admins at
     `https://www.d6e.ai/{locale}/account/franchise`
     (the client's redirect URI list);
   - **the d6e instance**: add the URI to `ALLOWED_REDIRECT_URIS` in the
     instance's `.env`.
7. **Redeploy / restart the d6e instance** so the `.env` change takes
   effect (e.g. `docker compose up -d` on the instance host) — plan this
   with the instance operator, since it is the only step that touches
   the instance itself.

### 10-c. Marketplace listing (optional)

8. Publish to the marketplace via pull request to
   [d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry).

### Checklist

- [ ] API key created in the console and stored (`d6e_…`)
- [ ] Local agent connected to `http://<instance-host>:8081/mcp` (or REST via curl)
- [ ] SQL / Drive / SaaS calls verified from the local agent
- [ ] JS STFs validated with instant-run (not a local Node shim)
- [ ] Docker STFs validated with local `docker run`, then with `api_url` pointed at the instance
- [ ] Draft `template_prompt` mirrored into the local agent's rules during iteration
- [ ] `template.yaml` installed via Install from URL (PAT entered if the repo is private) and re-verified in d6e chat
- [ ] (Custom frontend) deployed redirect URI registered on www.d6e.ai **and** in the instance's `ALLOWED_REDIRECT_URIS`, then the instance restarted

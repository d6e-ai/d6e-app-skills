# SaaS binary downloads from plugins and agents

Related:

- [cross-package-recipes.md](cross-package-recipes.md) — wiring downloads into plugin workflows
- [bundled-files-in-workflows.md](bundled-files-in-workflows.md) — File UUIDs and `$input` patterns
- [effect-semantics.md](effect-semantics.md) — why Effect is not for binaries

Plugins and local AI agents often need to pull binary files (PDF, XLSX, images)
from connected SaaS providers (Google Workspace, Box, GitHub, …). JSON-oriented
calls use `d6e_call_external_api` / `POST /api/v1/saas-proxy`; binary content
uses a separate two-step download path.

## MCP and REST equivalence

| Layer | Tool / endpoint | Role |
|-------|-----------------|------|
| MCP | `d6e_download_external_file` | Agent-facing wrapper |
| REST | `POST /api/v1/saas-proxy-download` | Same operation over HTTP |
| Storage | `GET /api/v1/workspaces/{id}/files/{file_id}/download` | Stream bytes from workspace storage |

Flow:

1. **Download into storage** — call `d6e_download_external_file` (MCP) or
   `POST /api/v1/saas-proxy-download` (REST) with `provider`, `method`,
   `path`, optional `headers` / `body` / `query`. Credentials are applied
   server-side from workspace SaaS integrations (same as `saas-proxy`).
2. **Receive metadata** — response includes a workspace `storage_file` id
   (and often `suggested_filename`, content type, size).
3. **Read content** — pass the id to `d6e_view_image`, `d6e_extract_file_text`,
   or `d6e_download_file` for agent-side processing; or fetch bytes via the
   files download endpoint when building a UI.

Example REST shape (after obtaining a Bearer token and workspace id):

```bash
curl -s -X POST "${D6E_BASE_URL}/api/v1/saas-proxy-download" \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspace_id\": \"${WORKSPACE_ID}\",
    \"provider\": \"google_workspace\",
    \"method\": \"GET\",
    \"path\": \"/drive/v3/files/FILE_ID?alt=media\"
  }"
# -> { "id": "<storage-file-uuid>", "filename": "...", ... }
```

## Custom frontends must proxy downloads

Browser clients **must not** redirect users to `D6E_BASE_URL` for file bytes
(cross-origin cookies and token exposure). Custom frontends should:

1. Call `saas-proxy-download` from a **same-origin server route** (server-held
   access token).
2. Stream the file to the browser via a **same-origin download proxy**
   (`GET /api/files/{id}/download` on the frontend app, not a 302 to d6e).

Full proxy patterns, size caps (100 MB for `saas-proxy-download`), streaming
on Vercel/Cloudflare, and reference implementations live in
**[d6e-custom-frontend-skills](https://github.com/d6e-ai/d6e-custom-frontend-skills)**:

- [`skills/d6e-workspace-api-client/references/download-two-step.md`](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/skills/d6e-workspace-api-client/references/download-two-step.md)
- [`skills/d6e-workspace-api-client/references/saas-proxy-download.md`](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/skills/d6e-workspace-api-client/references/saas-proxy-download.md)

## Plugin authoring notes

- Workflow **Fetch** input steps are for JSON HTTP responses (5 MB cap, 60 s
  timeout) — not for binary SaaS downloads. Use agent/MCP download tools or a
  custom frontend proxy for binaries. Full recipe:
  [cross-package-recipes.md](cross-package-recipes.md).
- Docker STFs cannot call `saas-proxy-download`; prefetch via agent/MCP then pass
  storage file id into the workflow — see [bundled-files-in-workflows.md](bundled-files-in-workflows.md).
- Ensure the target workspace has the SaaS provider connected (Console → Admin
  → SaaS integrations) before relying on download tools in demos or docs.
- For Google Drive files already mirrored in `drive_files`, prefer
  `d6e_read_drive_file` (cached) over `d6e_download_external_file`.

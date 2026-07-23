# Bundled files and workflow File inputs

Plugin `files:` entries are uploaded at install time. Each install assigns a **new
workspace storage UUID** — you cannot hardcode `File.id` in `template.yaml`
workflows and expect portable installs.

Related:

- [unsupported-and-phantom.md](unsupported-and-phantom.md) — `input_steps.content_type` no-op
- [cross-package-recipes.md](cross-package-recipes.md) — SaaS binaries and agent materialization
- [saas-and-downloads.md](saas-and-downloads.md) — MCP/REST download into storage

## Why UUIDs change

1. Installer reads each `files[].path`, uploads via multipart API.
2. API returns a **new** `storage_file` id per upload.
3. Re-install or update uploads again → **new UUIDs** (even for the same logical
   `files[].name`).

The installer **does not rewrite** `{ type: File, id: "..." }` in workflow
`input_steps` to point at freshly uploaded plugin files. A UUID baked into
`template.yaml` only works if that exact file already existed in the target
workspace before install — not for bundled plugin files.

Bundled files are primarily for **agent discovery by name** (file listing,
prompt references), not stable workflow wiring in the manifest.

## Recipe A — Post-install resolve UUID (MCP / API)

After install:

1. List workspace files (`d6e_list_files` / files API) filtered by filename or
   plugin naming convention.
2. Update the workflow (API/MCP) to set `input_steps[].source` to
   `{ type: File, id: "<resolved-uuid>" }`.

Best for one-time setup scripts or agent-driven install verification.

## Recipe B — STF SQL lookup

Add an early STF step (or instant-run helper) that queries workspace metadata
(if exposed via SQL views/tables your policies allow) to map logical name → file
id, then pass id to later steps via `$steps[0]`.

Requires policy allows on metadata tables and stable filename columns — verify
against your instance's file projection schema.

## Recipe C — Fetch re-download

If the file is also available at a stable HTTPS URL (public object, release
asset, raw GitHub URL):

```yaml
input_steps:
  - name: load-template
    source:
      type: Fetch
      url: "https://example.com/static/template.json"
      method: GET
```

Subject to Fetch limits (60 s timeout, 5 MB, JSON-oriented). Not for large
binaries — see Recipe D and [saas-and-downloads.md](saas-and-downloads.md).

## Recipe D — Agent materialize → File input

For SaaS or binary content:

1. Agent or custom frontend uses `d6e_download_external_file` /
   `POST /api/v1/saas-proxy-download` → storage id.
2. Run workflow with `$input` mapping to `{ type: File, id: "<id>" }` on an
   input step, or pass file reference in workflow execution input if the workflow
   is designed for runtime `$input`.

See [cross-package-recipes.md](cross-package-recipes.md) for the full SaaS binary
path and [saas-and-downloads.md](saas-and-downloads.md) for the two-step download
and custom frontend proxy (d6e-custom-frontend-skills).

## Design guidance

| Goal | Recommended approach |
|------|----------------------|
| Agent reads reference doc by name | Bundle under `files:`; mention in `template_prompt` |
| Workflow always uses same bundled XLSX | Post-install UUID patch, STF lookup, or Fetch URL |
| User-uploaded file each run | `$input` with file id from UI/agent — not hardcoded in template |
| SaaS PDF/Excel in workflow | MCP download → storage → File input / `$input` |

Do **not** put storage UUIDs in git-tracked `template.yaml` for plugin-owned files
unless you accept broken installs on every fresh workspace.

# Cross-package recipes (SaaS binaries, external APIs, instance skills)

Plugins declare what the **installer** can create from `template.yaml`. Many
capabilities live in **agent-side skills**, MCP tools, or custom frontends —
they are not template-declarable. This page bridges plugin workflows with those
paths.

Related:

- [saas-and-downloads.md](saas-and-downloads.md) — `d6e_download_external_file`, REST, frontend proxy
- [bundled-files-in-workflows.md](bundled-files-in-workflows.md) — File UUID regeneration
- [effect-semantics.md](effect-semantics.md) — Effect limits vs Fetch
- [unsupported-and-phantom.md](unsupported-and-phantom.md) — what templates cannot do

## SaaS binary into a plugin workflow

Goal: run a workflow STF against bytes from Google Drive, Box, freee export, etc.

**Constraints:**

- Workflow **Fetch** — JSON only, **5 MB**, **60 s** max, fails on non-2xx.
  Not for PDF/XLSX binaries.
- **Docker STF** `api_token` can call workspace SQL and STF APIs — **cannot** use
  `saas-proxy` / `saas-proxy-download` (those require user/agent auth context).
- **Effect** — no binary body in workflow result; non-JSON → null; no status
  fail on 4xx/5xx.

**Recommended pattern:**

```text
Console: connect SaaS integration (Admin → SaaS integrations)
    ↓
Agent or custom frontend:
  d6e_download_external_file / POST /api/v1/saas-proxy-download
    → workspace storage file id
    ↓
d6e_execute_workflow with input mapping File { id } or STF that reads file id from $input
    ↓
Plugin STF processes file (JS/Docker)
```

Custom browser apps must proxy downloads same-origin — see
[d6e-custom-frontend-skills download references](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/skills/d6e-workspace-api-client/references/saas-proxy-download.md)
linked from [saas-and-downloads.md](saas-and-downloads.md).

For Drive files already in `drive_files`, prefer cached `d6e_read_drive_file`
when the agent drives the flow; storage download path when the workflow needs a
`File` input step id.

## Effect vs MCP vs Docker — external API boundary

| Need | Effect (template) | MCP / REST (agent) | Docker STF |
|------|-------------------|--------------------|------------|
| Declarative in plugin manifest | Yes (`effects:`) | No | Yes (`stfs:` docker) |
| Slack/webhook side effect | Good fit | Also possible | Overkill |
| Fail on HTTP 4xx/5xx | **No** | Depends on tool | Your code |
| Timeout | **None** (platform) | Tool-specific | `STF_DOCKER_TIMEOUT_SECS` |
| JSON body to next STF step | **No** (not in return) | N/A | Via `$steps[n]` |
| SaaS OAuth APIs (Google, etc.) | Public URL only | **`d6e_call_external_api` / saas-proxy** | SQL + public HTTP only |
| Binary download | **No** | **`d6e_download_external_file`** | Stream via stdin if prefetched |
| Secrets | Effect URL fixed; no OAuth | Server-side SaaS creds | Install-time `env` secrets |

**Rule of thumb:** template **Effect** for simple outbound webhooks; **MCP** for
SaaS and binaries; **Docker** for heavy local processing with prefetched inputs.

## Instance skills (agent-side, not in template.yaml)

Skills such as **d6e-saas-***, embedding helpers, workspace API client patterns,
and custom-frontend integration live in separate skill packages. They teach the
**coding agent** how to call the live instance — they are **not** entries you add
to `template.yaml`.

| Capability | Template-declarable? | Where it lives |
|------------|----------------------|----------------|
| `template_prompt`, STFs, files, effects, workflows | Yes | Plugin repo |
| `d6e_call_external_api`, download tools | No | Agent MCP session |
| d6e-saas-* integration playbooks | No | Instance / org skills |
| Policy creation | No (post-install) | [policy-and-instant-run.md](policy-and-instant-run.md) |
| Pin workflow steps to version | No (`pin_version` forced false) | [pinning-and-versions.md](pinning-and-versions.md) |

Plugin authors should reference required agent capabilities in **README** and
`template_prompt` (e.g. "use d6e_download_external_file before running workflow X")
rather than assuming the installer embeds SaaS or skill behavior.

## End-to-end example (meeting notes + Drive PDF)

1. Plugin bundles STF `extract-text` (JS) and workflow expecting `$input.file_id`.
2. README: connect Google Workspace; create STF policy group per
   [policy-and-instant-run.md](policy-and-instant-run.md).
3. Agent flow: SQL `drive_files` → `d6e_download_external_file` or
   `d6e_read_drive_file` → `d6e_execute_workflow` with `file_id`.
4. No hardcoded File UUID in `template.yaml` — see
   [bundled-files-in-workflows.md](bundled-files-in-workflows.md).

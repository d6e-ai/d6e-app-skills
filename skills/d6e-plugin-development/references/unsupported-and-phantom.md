# Unsupported and phantom template.yaml features

Some fields appear in JSON Schema, example manifests, or older docs but are **not
implemented** by the plugin installer, **not honored at runtime**, or **behave
differently than authors expect**. Treat this page as the source of truth before
shipping a plugin.

See also:

- [pinning-and-versions.md](pinning-and-versions.md) — `pin_version` installer behavior
- [effect-semantics.md](effect-semantics.md) — Effect HTTP and return-value semantics
- [policy-and-instant-run.md](policy-and-instant-run.md) — policies and instant-run vs workflow SQL
- [bundled-files-in-workflows.md](bundled-files-in-workflows.md) — File UUID regeneration

## `policies:` in template.yaml — NOT implemented

The installer **does not read or create** a top-level `policies:` section (nor any
policy block inside `template.yaml`). Any guidance that says you can "ship policies
in the manifest" or install them automatically is **phantom documentation**.

**What to do instead:** create policies **after install** via:

- Console → Admin → Policies
- MCP: `d6e_create_policy_group`, `d6e_create_policy`
- REST: policy group and policy APIs

Use [policy-and-instant-run.md](policy-and-instant-run.md) for the post-install
checklist (STF name → policy group → table allow).

> **WARNING:** [docs/local-ai-development.md](../../../docs/local-ai-development.md)
> previously mentioned `policies:` in `template.yaml` as an install path. That is
> not implemented — always create policies post-install.

## `runtime: wasm` — installs, fails at execute

The schema allows `runtime: wasm` and the installer will register the STF, but
execution fails with **`UnsupportedRuntime`** (or equivalent runtime error). WASM
STFs are not supported in the current engine.

**Supported runtimes for plugins:** `js` and `docker` only.

Do not document WASM as a supported plugin runtime. If a manifest or schema lists
`wasm`, treat it as legacy schema surface — authors must use `js` or `docker`.

## `workflow.input_schema` — not in template; API/MCP only

Workflow-level `input_schema` (JSON Schema for workflow execution input) is
supported by the **engine** when creating or updating workflows via API/MCP, but
the **plugin installer does not accept** `input_schema` on entries under
`workflows:` in `template.yaml`. Omit it from manifests; add or change it after
install if needed.

## `pin_version` — cannot be set from template

Workflow STF and Effect steps support `pin_version` in the API, but the plugin
installer **always writes `pin_version: false`** for every bundled step. There is
no template.yaml field to opt into pinning at install time.

See [pinning-and-versions.md](pinning-and-versions.md) for execution-time latest
resolution and re-install re-pin behavior.

## `input_steps.content_type` — no-op

The optional `content_type` field on input steps (`json` / `text` / binary hint)
is **not applied** by the engine for File or Fetch sources. MIME type and parsing
come from **workspace storage metadata** (File) or Fetch JSON parsing only — not
from this template field.

Do not rely on `content_type` to change how a step resolves; fix storage content
type or use a different source type.

## STF / Effect `input_schema` — stored, not validated at execute

STF and Effect versions may carry `input_schema` in the API (and examples sometimes
include it in `template.yaml`). The engine **stores** these schemas but **does not
validate** step input against them at workflow execution time.

**`output_schema` on STFs is validated** — a mismatch aborts the workflow after
that STF step. See [timeouts.md](timeouts.md).

Effect versions have no output schema validation in the same way; Effect HTTP
success/failure semantics are separate — see [effect-semantics.md](effect-semantics.md).

## `is_public` — not settable from template

Resource visibility flags such as `is_public` on STFs, Effects, or workflows are
**not** exposed in `template.yaml` and are **not** set by the installer. Defaults
and visibility are determined by the platform API defaults and console/MCP updates
after install.

## Quick reference

| Feature | In template.yaml? | At install / runtime |
|---------|-------------------|----------------------|
| `policies:` | Sometimes documented | **Ignored** — create post-install |
| `runtime: wasm` | Schema allows | Registers then **fails at run** |
| `workflows[].input_schema` | Not supported | Use API/MCP after install |
| `pin_version` on steps | Not honored | Installer forces **`false`** |
| `input_steps.content_type` | Allowed | **No-op** |
| STF/Effect `input_schema` | May be sent | **Stored only**, no execute validation |
| STF `output_schema` | May be sent | **Validated** at execute |
| `is_public` | N/A | **Not set** from template |

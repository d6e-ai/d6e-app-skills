# template.yaml Specification

Full specification for d6e App manifest files. See the [JSON Schema](../schema/template.schema.json) for machine-readable validation.

## Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | App name (lowercase, hyphens, `^[a-z0-9][a-z0-9-]*[a-z0-9]$`) |
| `namespace` | string | Yes | Author/org namespace (same pattern as name) |
| `version` | string | Yes | Semver version with `v` prefix (`vMAJOR.MINOR.PATCH`). The installer strips the `v` when registering resources |
| `description` | string \| object | Yes | Short description (max 200 characters), or a locale map (`{ en-US: ..., ja-JP: ... }`) |
| `template_prompt` | string | No | System prompt injected into AI agent context |
| `stfs` | array | No | STF definitions |
| `files` | array | No | File references |
| `effects` | array | No | Effect definitions |
| `workflows` | array | No | Workflow definitions |

## STF Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier within the app. Installed as `{namespace}/{app}/{name}` |
| `runtime` | `js` \| `wasm` \| `docker` | Yes | Execution runtime |
| `description` | string | Yes | Human-readable description |
| `source` | string | Conditional | Path to source file (required for `js`, `wasm`). Installer reads the file, base64-encodes, and sends as `code` to the API. |
| `image` | string | Conditional | Docker image (required for `docker`) |
| `command` | array of strings | No | Docker command override (e.g., `["python3", "main.py"]`). A single string is rejected |
| `env` | object | No | Environment variables (docker only). Each key becomes an install-dialog input; admin-entered values are stored as encrypted STF secrets and flagged in the Docker config's `secret_keys` |
| `input_schema` | object | No | JSON Schema for input validation |
| `output_schema` | object | No | JSON Schema for output validation |

**JS STF code style**: the runtime executes the source file as a plain
script wrapped in an async IIFE — NOT as an ES module. Write top-level
code that reads the global `$input` and ends with a top-level
`return { ... }`. `export default function ...` fails at execution with
`SyntaxError: Unexpected token 'export'`. See the d6e-app-development
skill ("JS STF Code Style") for details.

## File Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier. Installed as `{namespace}/{app}/{name}` |
| `description` | string | Yes | Purpose of the file |
| `path` | string | Yes | Relative path from template.yaml. Installer uploads via `POST /api/v1/workspaces/{workspace_id}/files/multipart`. |

After upload, files get fresh UUIDs in workspace storage. The AI agent
can find them by name via the file listing; workflows can only reference
files whose UUID is known in advance (see Input Step caution below).

## Effect Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier. Installed as `{namespace}/{app}/{name}` |
| `description` | string | Yes | What this effect does |
| `version` | string | No | Defaults to the app version. If set, plain semver **without** the `v` prefix (`1.0.0`) — the API rejects `v1.0.0` |
| `url` | string | Yes | Target URL |
| `method` | string | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `header_mappings` | object | Yes | Header mappings (`$.path` = variable, other strings = constants) |
| `body_mappings` | object | Yes | JSON body field mappings (same syntax) |
| `query_mappings` | object | No | URL query parameter mappings (same syntax) |
| `input_schema` | object | No | JSON Schema for input validation |

Mapping values starting with `$.` are variables resolved against the
effect step's resolved input object at execution time; anything else is
sent as a constant. Example: `text: "$.message"` sends the `message`
field mapped in the workflow's effect step `input_mappings`.

## Workflow Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `description` | string | Yes | What this workflow does |
| `input_steps` | array | No | Input data source steps |
| `stf_steps` | array | No | STF execution steps |
| `effect_steps` | array | No | Effect execution steps |

**Important**: Workflows use three separate arrays, not a single flat list. This matches the d6e Rust API structure.

### Input Step

```yaml
input_steps:
  - name: fetch-data
    source:
      type: Fetch
      url: https://api.example.com/data
      method: GET
      timeout_secs: 30
```

Source types:
- `Library`: `{ type: Library, name: "library-name" }` — resolves to `{ code, types, version }` of a pre-registered STF library
- `File`: `{ type: File, id: "UUID" }` — loads a workspace storage file by UUID at execution time. **Caution**: the installer does NOT rewrite this field. The UUID must belong to a file that already exists in the target workspace; it cannot point to files bundled in the app (those get fresh UUIDs at install)
- `Fetch`: `{ type: Fetch, url: "...", method: "GET", headers: {}, body: ..., timeout_secs: 30 }` — resolves to the parsed JSON response body

Input steps run in parallel before any STF step. Their resolved values
are available to mappings as `$sources.{name}` and are also passed to
Docker STFs via the `sources` field of the stdin JSON.

### STF Step

```yaml
stf_steps:
  - stf_name: process-data       # matches name in stfs list
    input_mappings:
      - source: { type: Variable, value: "$sources.fetch-data" }
        target: data
      - source: { type: Const, value: "default" }
        target: mode
```

The installer resolves `stf_name` to `stf_version_id` (UUID) when creating the workflow via API.

### Effect Step

```yaml
effect_steps:
  - effect_name: notify-slack    # matches name in effects list
    input_mappings:
      - source: { type: Variable, value: "$steps[0].summary" }
        target: message
```

The installer resolves `effect_name` to `effect_version_id` (UUID) when creating the workflow via API.
Effect steps run in parallel after all STF steps complete. The workflow's
return value is the last STF step's output.

### Field Mapping

| Field | Type | Description |
|-------|------|-------------|
| `source.type` | `Const` \| `Variable` | Static value or dynamic field path |
| `source.value` | any | For Const: literal value. For Variable: engine variable path (see below) |
| `target` | string | Target field name in the step's input |

Variable paths are passed to the API **unchanged**, so they must use the
engine syntax:

| Path | Resolves to |
|------|-------------|
| `$input` / `$input.field` | Workflow execution input |
| `$sources.{step_name}` / `$sources.{step_name}.field` | Resolved input step value |
| `$steps[n]` / `$steps[n].field` | Output of the n-th STF step (0-based) |

Paths without one of these `$` roots fail at execution time with
`Unknown variable root`. Paths to missing fields resolve to `null`
without an error.

## Validation

Use the JSON Schema for automated validation:

```bash
npx ajv-cli validate -s schema/template.schema.json -d template.yaml
```

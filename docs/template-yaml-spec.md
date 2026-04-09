# template.yaml Specification

Full specification for d6e App manifest files. See the [JSON Schema](../schema/template.schema.json) for machine-readable validation.

## Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | App name (lowercase, hyphens, `^[a-z0-9][a-z0-9-]*[a-z0-9]$`) |
| `namespace` | string | Yes | Author/org namespace (same pattern as name) |
| `version` | string | Yes | Semver version (`vMAJOR.MINOR.PATCH`) |
| `description` | string | Yes | Short description (max 200 characters) |
| `template_prompt` | string | No | System prompt injected into AI agent context |
| `stfs` | array | No | STF definitions |
| `files` | array | No | File references |
| `effects` | array | No | Effect definitions |
| `workflows` | array | No | Workflow definitions |

## STF Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier within the app |
| `runtime` | `js` \| `wasm` \| `docker` | Yes | Execution runtime |
| `description` | string | Yes | Human-readable description |
| `source` | string | Conditional | Path to source file (required for `js`, `wasm`). Installer reads the file, base64-encodes, and sends as `code` to the API. |
| `image` | string | Conditional | Docker image (required for `docker`) |
| `command` | string | No | Docker command override |
| `env` | object | No | Environment variables (docker only) |
| `input_schema` | object | No | JSON Schema for input validation |
| `output_schema` | object | No | JSON Schema for output validation |

## File Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `description` | string | Yes | Purpose of the file |
| `path` | string | Yes | Relative path from template.yaml. Installer uploads via `POST /api/v1/files` (multipart/form-data). |

After upload, files are referenced by UUID in workspace storage. Workflows reference them via `InputSource::File { id: UUID }`.

## Effect Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `description` | string | Yes | What this effect does |
| `version` | string | Yes | Semver version (e.g., `v1.0.0`) |
| `url` | string | Yes | Target URL |
| `method` | string | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `header_mappings` | object | Yes | Header key-value mappings |
| `body_mappings` | object | Yes | Body field mappings |
| `input_schema` | object | No | JSON Schema for input validation |

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
  - name: load-template
    source:
      type: File
      id: null  # resolved to UUID at install time
```

Source types:
- `Library`: `{ type: Library, name: "library-name" }`
- `File`: `{ type: File, id: "UUID" }` — UUID resolved at install time
- `Fetch`: `{ type: Fetch, url: "...", method: "GET", headers: {}, timeout_secs: 30 }`

### STF Step

```yaml
stf_steps:
  - stf_name: process-data       # matches name in stfs list
    input_mappings:
      - source: { type: Variable, value: "sources.fetch-data" }
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
      - source: { type: Variable, value: "steps.0.output" }
        target: message
```

The installer resolves `effect_name` to `effect_version_id` (UUID) when creating the workflow via API.

### Field Mapping

| Field | Type | Description |
|-------|------|-------------|
| `source.type` | `Const` \| `Variable` | Static value or dynamic field path |
| `source.value` | any | For Const: literal value. For Variable: dot-notation path (e.g., `sources.step-name`, `steps.0.output`) |
| `target` | string | Target field name in the step's input |

## Validation

Use the JSON Schema for automated validation:

```bash
npx ajv-cli validate -s schema/template.schema.json -d template.yaml
```

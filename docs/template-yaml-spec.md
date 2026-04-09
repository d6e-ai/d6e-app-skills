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
| `source` | string | Conditional | Path to source file (required for `js`, `wasm`) |
| `image` | string | Conditional | Docker image (required for `docker`) |
| `command` | string | No | Docker command override |
| `env` | object | No | Environment variables (docker only) |

## File Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `description` | string | Yes | Purpose of the file |
| `path` | string | Yes | Relative path from template.yaml |

## Effect Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `description` | string | Yes | What this effect does |
| `url` | string | Yes | Target URL |
| `method` | string | Yes | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) |
| `headers` | object | No | Default HTTP headers |

## Workflow Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `description` | string | Yes | What this workflow does |
| `steps` | array | Yes | Ordered list of steps (min 1) |

### Step Types

**Input Step**: `{ type: "input", name: "...", source: "library|file|fetch" }`
**STF Step**: `{ type: "stf", name: "...", stfName: "..." }`
**Effect Step**: `{ type: "effect", name: "...", effectName: "..." }`

## Validation

Use the JSON Schema for automated validation:

```bash
npx ajv-cli validate -s schema/template.schema.json -d template.yaml
```

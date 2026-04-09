---
name: d6e-app-development
description: Creates d6e App packages — reusable workspace configurations with prompts, STFs, files, effects, and workflows. Use when building a distributable d6e App, creating template.yaml manifests, or packaging workspace setups for the d6e App Marketplace.
---

# d6e App Development

## Overview

A d6e App is a distributable package that configures a d6e workspace with a combination of:

- **Template Prompt** — System prompt injected into the AI agent's context
- **STFs** (State Transition Functions) — Custom logic (JS, WASM, or Docker)
- **Files** — Reference documents, templates, or datasets (uploaded to workspace storage)
- **Effects** — External API integrations with header/body mapping
- **Workflows** — Pipelines combining input steps, STF steps, and effect steps

Apps are defined by a `template.yaml` manifest and published to the d6e App Marketplace.

## When to Use

Apply this skill when users request:

- "Create a d6e app"
- "Package this workspace as an app"
- "Build a d6e template"
- "Create a template.yaml for d6e"
- "Publish a workspace configuration"
- "Make a reusable d6e workspace setup"

## Core Concepts

### template.yaml

The manifest file that declares all resources in an app. Located at the root of the app repository.

```yaml
name: my-app
namespace: my-org
version: v1.0.0
description: Short description of what this app does.

template_prompt: |
  You are a specialized assistant for [domain].
  Always follow these rules:
  - Rule 1
  - Rule 2

stfs:
  - name: process-data
    runtime: js
    description: Processes incoming data records
    source: stfs/process-data.js

  - name: validate-input
    runtime: docker
    description: Validates input against schema
    image: ghcr.io/my-org/validate-input:v1.0.0

files:
  - name: reference-template
    description: Template document for output formatting
    path: files/template.xlsx

effects:
  - name: notify-slack
    description: Sends notification to Slack
    version: v1.0.0
    url: https://hooks.slack.com/services/xxx
    method: POST
    header_mappings:
      Content-Type: application/json
    body_mappings:
      text: "$.input.message"

workflows:
  - name: daily-report
    description: Generates and sends daily report
    input_steps:
      - name: fetch-data
        source:
          type: Fetch
          url: https://api.example.com/data
          method: GET
    stf_steps:
      - stf_name: process-data
        input_mappings:
          - source: { type: Variable, value: "sources.fetch-data" }
            target: data
    effect_steps:
      - effect_name: notify-slack
        input_mappings:
          - source: { type: Variable, value: "steps.0.output" }
            target: message
```

### How Installation Works

When a d6e instance installs an app from `template.yaml`, the installer performs these transformations:

1. **STFs**: Reads the file at `source` path, base64-encodes it, and calls `POST /api/v1/stfs` with `{name, runtime, code (base64), version}`. Receives a UUID back.
2. **Files**: Reads the file at `path`, uploads via `POST /api/v1/files` (multipart/form-data). Receives a UUID back.
3. **Effects**: Calls `POST /api/v1/effects` with `{name, version, url, method, header_mappings, body_mappings}`. Receives a UUID back.
4. **Workflows**: Resolves STF/Effect names to their version UUIDs, then calls `POST /api/v1/workflows` with `{name, input_steps, stf_steps (with stf_version_id), effect_steps (with effect_version_id)}`.
5. **Template Prompt**: Stored in the `workspace_app` record (Drizzle) and automatically injected into the AI agent's system context.

This means `template.yaml` uses **human-readable names and file paths** as a declaration format, while the actual API uses **UUIDs and base64-encoded content**. The installer bridges the two.

### alias@version Scheme

Every resource uses `namespace/name@version` for identification:

- `d6e/hello-world@v1.0.0` — namespace `d6e`, app `hello-world`, version `v1.0.0`
- Namespace must match the app author's registered namespace
- Version follows semver (vMAJOR.MINOR.PATCH)

### Prompt Separation

Apps define a `template_prompt` that is injected into the AI agent's system context. This is separate from the workspace's `custom_prompt` which users edit freely. Both are combined at runtime:

```
System Prompt = Base Skills + Template Prompts (from apps, ordered by install date) + Custom Prompt (user)
```

Multiple installed apps each contribute their own `template_prompt`, combined in `installedAt ASC` order with `## APP: namespace/name@version` headers.

## Quick Start

Create a minimal hello-world app in 3 steps:

### Step 1: Create directory structure

```
my-app/
├── template.yaml
├── prompt.md          # optional, for long prompts
├── stfs/
│   └── hello.js
└── files/             # optional, for bundled files
    └── greeting.txt
```

### Step 2: Write template.yaml

```yaml
name: hello-world
namespace: my-org
version: v0.1.0
description: A minimal d6e App example.

template_prompt: |
  You are a friendly assistant. Always greet the user warmly.

stfs:
  - name: hello
    runtime: js
    description: Returns a greeting message
    source: stfs/hello.js

files:
  - name: greeting
    description: Default greeting text
    path: files/greeting.txt
```

### Step 3: Write the STF

```javascript
// stfs/hello.js
// Simple greeting STF that returns a hello message.
export default function (input) {
  const name = input.name || 'World';
  return { message: `Hello, ${name}!` };
}
```

## template.yaml Full Reference

### Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | App name (lowercase, hyphens allowed) |
| `namespace` | string | Yes | Author/organization namespace |
| `version` | string | Yes | Semver version (e.g., `v1.0.0`) |
| `description` | string | Yes | Short description (max 200 chars) |
| `template_prompt` | string | No | System prompt text |
| `stfs` | array | No | STF definitions |
| `files` | array | No | File references |
| `effects` | array | No | Effect definitions |
| `workflows` | array | No | Workflow definitions |

### STF Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | STF identifier (used in workflow references) |
| `runtime` | `js` \| `wasm` \| `docker` | Yes | Execution runtime |
| `description` | string | Yes | What this STF does |
| `source` | string | For js/wasm | Relative path to source file (installer reads and base64-encodes) |
| `image` | string | For docker | Docker image reference |
| `command` | string | No | Docker command override |
| `env` | object | No | Environment variables (docker only) |
| `input_schema` | object | No | JSON Schema for input validation |
| `output_schema` | object | No | JSON Schema for output validation |

**Note**: The `source` file is read by the installer, base64-encoded, and sent to `POST /api/v1/stfs` as the `code` field. The file itself is not stored — only the encoded content.

### File Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | File identifier |
| `description` | string | Yes | What this file is for |
| `path` | string | Yes | Relative path to the file (installer uploads via multipart) |

**Note**: Files are uploaded to workspace-scoped storage via `POST /api/v1/files` (multipart/form-data). After upload, files are referenced by UUID (e.g., in `InputSource::File { id: UUID }` within workflows).

### Effect Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Effect identifier (used in workflow references) |
| `description` | string | Yes | What this effect does |
| `version` | string | Yes | Semver version (e.g., `v1.0.0`) |
| `url` | string | Yes | Target URL |
| `method` | string | Yes | HTTP method (GET/POST/PUT/PATCH/DELETE) |
| `header_mappings` | object | Yes | Header key-value mappings |
| `body_mappings` | object | Yes | Body field mappings (JSONPath expressions) |
| `input_schema` | object | No | JSON Schema for input validation |

### Workflow Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow identifier |
| `description` | string | Yes | What this workflow does |
| `input_steps` | array | No | Input data source steps |
| `stf_steps` | array | No | STF execution steps |
| `effect_steps` | array | No | Effect execution steps |

**Important**: The d6e API stores workflows with three separate arrays (`input_steps`, `stf_steps`, `effect_steps`), not a single flat `steps` list. The installer maps template names to UUIDs during installation.

#### Input Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Step name (referenced as `sources.{name}` in mappings) |
| `source` | object | Yes | Input source definition |

Input source types:
- `{ type: Library, name: "library-name" }` — Load STF library from global scope
- `{ type: File, id: "UUID" }` — Load file from workspace storage (resolved at install time)
- `{ type: Fetch, url: "...", method: "GET" }` — Fetch from external HTTP endpoint

#### STF Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stf_name` | string | Yes | STF name from the `stfs` list (installer resolves to `stf_version_id` UUID) |
| `input_mappings` | array | No | Field mappings from previous steps |

#### Effect Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effect_name` | string | Yes | Effect name from the `effects` list (installer resolves to `effect_version_id` UUID) |
| `input_mappings` | array | No | Field mappings from previous steps |

#### Field Mapping

Each mapping has:
- `source`: `{ type: Const, value: ... }` (static) or `{ type: Variable, value: "path.to.field" }` (dynamic)
- `target`: Target field name in the step's input

## Implementation Checklist

When creating a d6e App, verify:

- [ ] `template.yaml` is valid YAML and passes schema validation
- [ ] `name` uses lowercase letters, numbers, and hyphens only
- [ ] `namespace` matches your registered namespace
- [ ] `version` follows semver format (`vX.Y.Z`)
- [ ] All `source` paths in STFs point to existing files
- [ ] All `path` references in files point to existing files
- [ ] Effects have `version`, `header_mappings`, and `body_mappings`
- [ ] Workflow `stf_name`/`effect_name` references match names in the `stfs`/`effects` lists
- [ ] `template_prompt` does not contain instructions that could harm user data
- [ ] Docker images are publicly accessible (for docker STFs)
- [ ] No secrets or credentials are hardcoded in any file

## Best Practices

### Security

- Never include API keys, tokens, or credentials in template.yaml or any bundled file
- Template prompts should not instruct the AI to bypass user confirmation for destructive operations
- Docker images should use pinned versions (not `latest`)
- File contents should be reviewed — they become part of the workspace context

### Versioning

- Use semver: bump PATCH for fixes, MINOR for features, MAJOR for breaking changes
- Tag releases in git: `git tag v1.0.0 && git push --tags`
- Keep a CHANGELOG.md in your app repository

### Naming

- App names: lowercase, hyphens, descriptive (`accounting-assistant`, not `app1`)
- STF names: lowercase, hyphens, verb-noun (`process-data`, `validate-input`)
- Namespace: your GitHub org or username

### Directory Structure

Recommended layout for an App repository:

```
my-org/d6e-app-my-app/
├── template.yaml          # App manifest (required)
├── README.md              # App documentation (required)
├── CHANGELOG.md           # Version history (recommended)
├── stfs/                  # STF source files
│   ├── process-data.js
│   └── validate-input.js
├── files/                 # Bundled files (uploaded to workspace storage)
│   ├── template.xlsx
│   └── reference-data.csv
└── prompt.md              # Long-form prompt (optional, can be inlined in template.yaml)
```

## Publishing to Marketplace

### Step 1: Create a public GitHub repository

Follow the directory structure above. The repository root must contain `template.yaml`.

### Step 2: Tag a release

```bash
git tag v1.0.0
git push --tags
```

The tag version must match the `version` field in `template.yaml`.

### Step 3: Submit a PR to d6e-app-marketplace

Fork [d6e-ai/d6e-app-marketplace](https://github.com/d6e-ai/d6e-app-marketplace) and add two files:

**1. Registry entry** — `registry/{namespace}/{name}.yaml`:

```yaml
name: my-app
namespace: my-org
description: What my app does
tier: unverified
repo: https://github.com/my-org/d6e-app-my-app
category: business
icon: briefcase
versions:
  - version: v1.0.0
    releaseDate: "2026-04-09"
    manifestUrl: https://raw.githubusercontent.com/my-org/d6e-app-my-app/v1.0.0/template.yaml
    changelog: Initial release
    resources:
      stfs: 2
      files: 1
      effects: 0
      workflows: 1
readme: |
  ## My App
  Description of what this app does.
```

**2. Index update** — Add to `registry/index.yaml`:

```yaml
- namespace: my-org
  name: my-app
  description: What my app does
  tier: unverified
  category: business
  icon: briefcase
  latestVersion: v1.0.0
```

The `manifestUrl` must point to the raw GitHub URL for the tagged release, so that d6e instances can fetch the `template.yaml` at install time.

### How d6e Instances Find Your App

1. Each d6e instance periodically fetches `registry/index.yaml` from GitHub raw
2. The Browse tab on the Apps page displays all entries
3. When a user clicks Install, d6e fetches `manifestUrl` → gets `template.yaml` → creates resources via Rust API

### Tier System

- **Verified**: Reviewed and approved by d6e team. Green badge.
- **Unverified**: Community-submitted, not reviewed. Yellow badge with warning.

New submissions start as `unverified`. Contact the d6e team for verification review.

## Troubleshooting

### "template.yaml validation failed"

- Check YAML syntax (use a YAML linter)
- Verify all required fields are present
- Ensure `runtime` is one of: `js`, `wasm`, `docker`

### "STF source file not found"

- Verify the `source` path is relative to `template.yaml` location
- Check file exists and is not in `.gitignore`

### "Docker image not accessible"

- Ensure the image is pushed to a public registry
- Use the full image reference including tag (e.g., `ghcr.io/org/image:v1.0.0`)

### "Template prompt too long"

- Keep prompts focused and concise (recommended: under 2000 characters)
- Move detailed instructions to files that the AI can reference

### "Workflow STF/Effect not found"

- Verify `stf_name` / `effect_name` in workflow steps exactly match the `name` in the `stfs` / `effects` lists
- Names are case-sensitive

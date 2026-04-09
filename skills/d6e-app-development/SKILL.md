---
name: d6e-app-development
description: Creates d6e App packages — reusable workspace configurations with prompts, STFs, files, effects, and workflows. Use when building a distributable d6e App, creating template.yaml manifests, or packaging workspace setups for the d6e App Marketplace.
---

# d6e App Development

## Overview

A d6e App is a distributable package that configures a d6e workspace with a combination of:

- **Template Prompt** — System prompt injected into the AI agent's context
- **STFs** (State Transition Functions) — Custom logic (JS, WASM, or Docker)
- **Files** — Reference documents, templates, or datasets
- **Effects** — External API integrations
- **Workflows** — Pipelines combining inputs, STFs, and effects

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
    url: https://hooks.slack.com/services/xxx
    method: POST

workflows:
  - name: daily-report
    description: Generates and sends daily report
    steps:
      - type: input
        name: fetch-data
        source: library
        libraryId: null  # resolved at install time
      - type: stf
        name: process
        stfName: process-data
      - type: effect
        name: notify
        effectName: notify-slack
```

### alias@version Scheme

Every resource uses `namespace/name@version` for identification:

- `d6e/hello-world@v1.0.0` — namespace `d6e`, app `hello-world`, version `v1.0.0`
- Namespace must match the app author's registered namespace
- Version follows semver (vMAJOR.MINOR.PATCH)

### Prompt Separation

Apps define a `template_prompt` that is injected into the AI agent's system context. This is separate from the workspace's `custom_prompt` which users edit freely. Both are combined at runtime:

```
System Prompt = Base Skills + Template Prompt (from apps) + Custom Prompt (user)
```

## Quick Start

Create a minimal hello-world app in 3 steps:

### Step 1: Create directory structure

```
my-app/
├── template.yaml
├── prompt.md          # optional, for long prompts
└── stfs/
    └── hello.js
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
| `name` | string | Yes | STF identifier |
| `runtime` | `js` \| `wasm` \| `docker` | Yes | Execution runtime |
| `description` | string | Yes | What this STF does |
| `source` | string | For js/wasm | Relative path to source file |
| `image` | string | For docker | Docker image reference |
| `command` | string | No | Docker command override |
| `env` | object | No | Environment variables (docker only) |

### File Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | File identifier |
| `description` | string | Yes | What this file is for |
| `path` | string | Yes | Relative path to the file |

### Effect Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Effect identifier |
| `description` | string | Yes | What this effect does |
| `url` | string | Yes | Target URL |
| `method` | string | Yes | HTTP method |
| `headers` | object | No | Default headers |

### Workflow Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow identifier |
| `description` | string | Yes | What this workflow does |
| `steps` | array | Yes | Ordered list of steps |

#### Step Types

- `input` — Data source (library, file, or fetch)
- `stf` — STF execution (references `stfName`)
- `effect` — Effect execution (references `effectName`)

## Implementation Checklist

When creating a d6e App, verify:

- [ ] `template.yaml` is valid YAML and passes schema validation
- [ ] `name` uses lowercase letters, numbers, and hyphens only
- [ ] `namespace` matches your registered namespace
- [ ] `version` follows semver format (`vX.Y.Z`)
- [ ] All `source` paths in STFs point to existing files
- [ ] All `path` references in files point to existing files
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

## Publishing to Marketplace

### Step 1: Create a public GitHub repository

Structure:
```
my-org/d6e-app-my-app/
├── template.yaml
├── README.md
├── CHANGELOG.md
└── stfs/
    └── ...
```

### Step 2: Tag a release

```bash
git tag v1.0.0
git push --tags
```

### Step 3: Submit a PR to d6e-app-marketplace

Add a registry entry in `registry/{namespace}/{name}.yaml`:

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

Also update `registry/index.yaml` to include your app in the master index.

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

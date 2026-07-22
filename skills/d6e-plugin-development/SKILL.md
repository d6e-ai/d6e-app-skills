---
name: d6e-plugin-development
description: Creates d6e Plugin packages — reusable workspace configurations with prompts, STFs, files, effects, and workflows. Use when building a distributable d6e Plugin, creating template.yaml manifests, or packaging workspace setups for the d6e Plugin Marketplace.
---

# d6e Plugin Development

## Overview

A d6e Plugin is a distributable package that configures a d6e workspace with a combination of:

- **Template Prompt** — System prompt injected into the AI agent's context
- **STFs** (State Transition Functions) — Custom logic (JS, WASM, or Docker)
- **Files** — Reference documents, templates, or datasets (uploaded to workspace storage)
- **Effects** — External API integrations with header/body mapping
- **Workflows** — Pipelines combining input steps, STF steps, and effect steps

Plugins are defined by a `template.yaml` manifest. They are installed into
a workspace either manually (the console's **Install from URL** —
recommended for development and team-internal plugins) or from the d6e Plugin
Marketplace, whose listings are maintained by pull request in the
[d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry)
repository.

## When to Use

Apply this skill when users request:

- "Create a d6e plugin"
- "Package this workspace as an plugin"
- "Build a d6e template"
- "Create a template.yaml for d6e"
- "Publish a workspace configuration"
- "Make a reusable d6e workspace setup"

## Core Concepts

### template.yaml

The manifest file that declares all resources in an plugin. Located at the root of the plugin repository.

```yaml
name: my-plugin
namespace: my-org
version: v1.0.0
description: Short description of what this plugin does.
# description can also be localized:
# description:
#   en-US: Short description of what this plugin does.
#   ja-JP: このプラグインの短い説明。

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
    command: ["python3", "main.py"]     # optional, must be an array
    env:
      EXTERNAL_API_KEY: ""              # installer asks the admin for a value
                                        # and stores it as an encrypted secret

files:
  - name: reference-template
    description: Template document for output formatting
    path: files/template.xlsx

effects:
  - name: notify-slack
    description: Sends notification to Slack
    # version is optional — defaults to the plugin version.
    # If you set it explicitly, use plain semver WITHOUT the "v" prefix
    # (the API rejects "v1.0.0"): version: "1.0.0"
    url: https://hooks.slack.com/services/xxx
    method: POST
    header_mappings:
      Content-Type: application/json     # no "$." prefix → constant
    body_mappings:
      text: "$.message"                  # "$." prefix → variable, resolved
                                         # against this effect step's input

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
          # Workflow mappings use the ENGINE syntax: $input, $sources.{name}, $steps[n]
          - source: { type: Variable, value: "$sources.fetch-data" }
            target: data
    effect_steps:
      - effect_name: notify-slack
        input_mappings:
          # $steps[0] = output of the first STF step (0-based)
          - source: { type: Variable, value: "$steps[0].summary" }
            target: message
```

Note the two different mapping syntaxes (a common source of broken plugins):

| Where | Syntax | Resolved against |
|-------|--------|------------------|
| Workflow `input_mappings` (`stf_steps` / `effect_steps`) | `$input.field`, `$sources.{step_name}.field`, `$steps[n].field` | Workflow execution context |
| Effect `header_mappings` / `body_mappings` / `query_mappings` | `"$.path"` for variables, any other string is a constant | The effect step's resolved input object |

In the example above: the effect step maps `$steps[0].summary` into its
input as `message`, and the effect's `body_mappings` then references it
as `"$.message"`.

### How Installation Works

Plugins are installed from the workspace's **Plugins** page in the d6e console.
Only **workspace admins** can install. There are two paths:

- **Browse tab**: plugins registered in the marketplace registry.
- **Install from URL**: any `template.yaml` URL (GitHub / GitLab web URLs
  are auto-rewritten to raw/API URLs; an access token can be supplied for
  private repositories).

When installing, the installer performs these transformations:

1. **STFs**: Reads the file at `source` path (or builds the Docker config
   JSON from `image`/`command`/`env`), base64-encodes it, and calls
   `POST /api/v1/stfs` with `{name, description, version, runtime, code}`.
   This one call creates the STF **and** its first version.
2. **Files**: Reads the file at `path`, uploads via
   `POST /api/v1/workspaces/{workspace_id}/files/multipart`. Receives a UUID back.
3. **Effects**: Calls `POST /api/v1/effects` with `{name, description,
   version, url, method, header_mappings, body_mappings, query_mappings}`.
4. **Workflows**: Resolves `stf_name` / `effect_name` to the version UUIDs
   created above, then calls `POST /api/v1/workflows` with
   `{name, input_steps, stf_steps (with stf_version_id), effect_steps (with effect_version_id)}`.
   Workflow `input_mappings` are passed through **unchanged** — they must
   already use the engine's `$input` / `$sources.{name}` / `$steps[n]` syntax.
5. **Template Prompt**: Stored in the `workspace_app` record and
   automatically injected into the AI agent's system context.

Additional behaviors to be aware of:

- **Resource names are prefixed**: an STF `process-data` in plugin
  `my-org/my-plugin` is created as `my-org/my-plugin/process-data`. This is how
  d6e distinguishes plugin resources and how re-installs find existing ones.
- **Version prefix is stripped**: the manifest's `v1.0.0` becomes `1.0.0`
  when registering STF/effect versions (the API only accepts plain semver).
- **Docker `env` values become install-time prompts**: for each key in a
  docker STF's `env`, the install dialog asks the admin for a value. Values
  the admin enters are stored as **encrypted STF secrets** (and the key is
  listed in the Docker config's `secret_keys`); keys left blank fall back
  to the plain-text value written in `template.yaml`.
- **Re-install / update**: if the plugin is already installed, the installer
  creates new STF/effect *versions* under the same resources and updates
  workflows in place.

This means `template.yaml` uses **human-readable names and file paths** as a declaration format, while the actual API uses **UUIDs and base64-encoded content**. The installer bridges the two.

### alias@version Scheme

Every resource uses `namespace/name@version` for identification:

- `d6e/hello-world@v1.0.0` — namespace `d6e`, plugin `hello-world`, version `v1.0.0`
- Namespace must match the plugin author's registered namespace
- Version follows semver (vMAJOR.MINOR.PATCH)

### Prompt Separation

Plugins define a `template_prompt` that is injected into the AI agent's system context. This is separate from the workspace's `custom_prompt` which users edit freely. Both are combined at runtime:

```
System Prompt = Base Skills + Template Prompts (from plugins, ordered by install date) + Custom Prompt (user)
```

Multiple installed plugins each contribute their own `template_prompt`, combined in `installedAt ASC` order with `## PLUGIN: namespace/name@version` headers.

## Quick Start

Create a minimal hello-world plugin in 3 steps:

### Step 1: Create directory structure

```
my-plugin/
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
description: A minimal d6e Plugin example.

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
// Top-level code: $input is a global, and the file must end with `return`.
const name = $input.name || 'World';
return { message: `Hello, ${name}!` };
```

## JS STF Code Style (CRITICAL)

The d6e runtime (QuickJS) wraps the entire source file in an async IIFE
and executes it as a **script**, not a module. This dictates the style:

```javascript
// ✅ CORRECT — top-level code, $input global, ends with return
const { records } = $input;
const processed = records.map((r) => ({ ...r, ok: true }));
return { processed, count: processed.length };
```

```javascript
// ❌ WRONG — `export` is a module keyword; the wrapper eval fails with
// "SyntaxError: Unexpected token 'export'"
export default function (input) {
  return { ok: true };
}
```

```javascript
// ❌ WRONG — defines a function but never returns anything
function main(input) {
  return { ok: true };
}
```

Rules:

- **No `export` / `module.exports`** — the code is not a module
- **`$input`** (global) is the STF's input object, built from the workflow
  step's `input_mappings` (or the `input` argument of `d6e_instant_run_stf`)
- **`$sources`** (global) gives raw access to all resolved input step
  values by name; `$caller` is the executing user's UUID string or `null`
- **Must end with a top-level `return { ... }`** — the returned object is
  the step output ($steps[n] in later mappings)
- `sql(query)` is available for workspace SQL (requires policy setup);
  helper functions may be declared and called, but the top level must
  still `return`
- Top-level `await` is supported (the wrapper is an async IIFE)
- `import ... from "@d6e-ai/..."` lines are allowed **only** for the
  built-in libraries (pdf-lib, xlsx, docx, pptxgenjs, crypto-js, fontkit,
  fonts) — they are rewritten to globals before execution. Any other
  import fails

## template.yaml Full Reference

### Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Plugin name (lowercase, hyphens allowed) |
| `namespace` | string | Yes | Author/organization namespace |
| `version` | string | Yes | Semver version with `v` prefix (e.g., `v1.0.0`) |
| `description` | string \| object | Yes | Short description (max 200 chars), or a locale map like `{ en-US: ..., ja-JP: ... }` |
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
| `command` | array of strings | No | Docker command override (e.g., `["python3", "main.py"]`) — a single string is **not** accepted |
| `env` | object | No | Environment variables (docker only). Each key becomes an input field in the install dialog; values entered there are stored as encrypted secrets |
| `input_schema` | object | No | JSON Schema for input validation |
| `output_schema` | object | No | JSON Schema for output validation |

**Note**: The `source` file is read by the installer, base64-encoded, and sent to `POST /api/v1/stfs` as the `code` field. The file itself is not stored — only the encoded content.

**Note (docker)**: never put real API keys in `env` values. Use an empty
string or placeholder and let the installing admin provide the real value
in the install dialog — it is then stored encrypted and injected at
container run time. See the `d6e-docker-stf-development` skill for the
container I/O contract (stdin JSON, `{"output": ...}` on stdout, errors
on stderr with non-zero exit).

### File Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | File identifier |
| `description` | string | Yes | What this file is for |
| `path` | string | Yes | Relative path to the file (installer uploads via multipart) |

**Note**: Files are uploaded to workspace-scoped storage via `POST /api/v1/workspaces/{workspace_id}/files/multipart` (multipart/form-data). After upload, files are referenced by UUID (e.g., in `InputSource::File { id: UUID }` within workflows) — but see the Input Step caution below: bundled files get fresh UUIDs at install, so workflows cannot reference them by UUID ahead of time. Bundled files are primarily for the AI agent to discover by name via the file listing.

### Effect Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Effect identifier (used in workflow references) |
| `description` | string | Yes | What this effect does |
| `version` | string | No | Defaults to the plugin version. If set explicitly, use plain semver **without** the `v` prefix (`1.0.0`) — the API rejects `v1.0.0` |
| `url` | string | Yes | Target URL |
| `method` | string | Yes | HTTP method (GET/POST/PUT/PATCH/DELETE) |
| `header_mappings` | object | Yes | Header mappings (see syntax below) |
| `body_mappings` | object | Yes | JSON body field mappings (see syntax below) |
| `query_mappings` | object | No | URL query parameter mappings (see syntax below) |
| `input_schema` | object | No | JSON Schema for input validation |

**Mapping syntax** (applies to `header_mappings`, `body_mappings`, `query_mappings`):

- A value starting with `$.` is a **variable**: `"$.message"` reads the
  `message` field of the effect step's resolved input object. Nested
  paths work too (`"$.user.email"`). Missing fields resolve to `null`.
- Any other value is a **constant**: `Content-Type: application/json`.

The effect's input object is built by the workflow's effect step
`input_mappings` — the effect never sees the raw workflow input, only
what the step maps into it. Effects are only executed inside workflows;
there is no standalone effect execution API.

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
| `name` | string | Yes | Step name (referenced as `$sources.{name}` in mappings) |
| `source` | object | Yes | Input source definition |
| `content_type` | string | No | Content-type hint for File sources (`json` / `text` / binary) |

Input source types:
- `{ type: Library, name: "library-name" }` — Load a pre-registered STF library; resolves to `{ code, types, version }`
- `{ type: File, id: "UUID" }` — Load a file from workspace storage by UUID. **Caution**: the installer does NOT rewrite this — the UUID is passed through as-is, so it can only reference a file that already exists in the target workspace. It cannot reference files bundled in the plugin's `files` section (those get fresh UUIDs at install time)
- `{ type: Fetch, url: "...", method: "GET", headers: {...}, body: ..., timeout_secs: 30 }` — Fetch from an external HTTP endpoint at execution time; resolves to the parsed JSON response body

#### STF Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stf_name` | string | Yes | STF name from the `stfs` list (installer resolves to `stf_version_id` UUID) |
| `input_mappings` | array | No | Field mappings building this STF's input object |

#### Effect Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effect_name` | string | Yes | Effect name from the `effects` list (installer resolves to `effect_version_id` UUID) |
| `input_mappings` | array | No | Field mappings building this effect's input object |

Execution order: input steps run first (in parallel), then STF steps run
sequentially in listed order, then effect steps run (in parallel). The
workflow's result is the **last STF step's output**.

#### Field Mapping

Each mapping has:
- `source`: `{ type: Const, value: ... }` (static) or `{ type: Variable, value: "$..." }` (dynamic)
- `target`: Target field name in the step's input

Variable paths must use the engine syntax (the installer does not rewrite them):

| Path | Meaning |
|------|---------|
| `$input` / `$input.field` | The workflow execution input |
| `$sources.{step_name}` / `$sources.{step_name}.field` | A resolved input step value |
| `$steps[n]` / `$steps[n].field` | Output of the n-th STF step (0-based); only earlier steps are available |

A path that points to a missing field resolves to `null` (no error), so
typos in field names surface as `null` inputs — double-check spelling.

## Implementation Checklist

When creating a d6e Plugin, verify:

- [ ] `template.yaml` is valid YAML and passes schema validation
- [ ] `name` uses lowercase letters, numbers, and hyphens only
- [ ] `namespace` identifies your org — it becomes the `{namespace}/{plugin}/` resource prefix (and the `registry/{namespace}/` directory if you list the plugin)
- [ ] Plugin `version` follows semver format with `v` prefix (`vX.Y.Z`)
- [ ] Effect `version`, if set, has NO `v` prefix (`1.0.0`) — or is omitted
- [ ] All `source` paths in STFs point to existing files
- [ ] JS STF code is top-level (`$input` global + final `return`), with NO `export` / function wrapper
- [ ] All `path` references in files point to existing files
- [ ] Effects have `header_mappings` and `body_mappings` (`{}` is fine)
- [ ] Workflow `stf_name`/`effect_name` references match names in the `stfs`/`effects` lists
- [ ] Workflow `input_mappings` variable paths start with `$input`, `$sources.`, or `$steps[`
- [ ] Effect mapping variables use the `$.field` form; constants have no `$.` prefix
- [ ] Docker `command` is an array of strings, not a single string
- [ ] Docker `env` contains no real secrets — admins supply values at install time
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
- Keep a CHANGELOG.md in your plugin repository

### Naming

- Plugin names: lowercase, hyphens, descriptive (`accounting-assistant`, not `app1`)
- STF names: lowercase, hyphens, verb-noun (`process-data`, `validate-input`)
- Namespace: your GitHub org or username

### Directory Structure

Recommended layout for an Plugin repository:

```
my-org/d6e-plugin-my-plugin/
├── template.yaml          # Plugin manifest (required)
├── README.md              # Plugin documentation (required)
├── CHANGELOG.md           # Version history (recommended)
├── stfs/                  # STF source files
│   ├── process-data.js
│   └── validate-input.js
├── files/                 # Bundled files (uploaded to workspace storage)
│   ├── template.xlsx
│   └── reference-data.csv
└── prompt.md              # Long-form prompt (optional, can be inlined in template.yaml)
```

## Testing Before Publishing (Install from URL)

You do not need marketplace publication to test. On the workspace's
**Plugins** page (`/{locale}/workspaces/{workspace_id}/plugins`, workspace
**admin** role required), use **Install from URL**:

1. Push the plugin repo (public or private) with `template.yaml` at the root
2. Paste the repo or `template.yaml` URL (GitHub/GitLab web URLs are
   rewritten to raw/API URLs automatically; private repos take an access
   token)
3. Docker STFs with `env` keys prompt for values — entered values become
   encrypted STF secrets
4. Re-run Install from URL after each push to update resources in place

Then verify in the workspace: the STFs/workflows appear with
`{namespace}/{plugin}/` name prefixes, and `d6e_execute_workflow` /
`d6e_instant_run_stf` can exercise them.

## Developing from a Local AI Agent (Codex / Claude Code / Cursor)

You can iterate against the live instance long before packaging —
everything the d6e chat agent can do is exposed as public HTTP APIs on
the instance, so a local AI coding agent gets tool-for-tool parity.

**1. Get an API key** (long-lived `d6e_...` Bearer token, carries your
user identity and workspace memberships): console → avatar in the
header → **API Keys** (`/{locale}/user/api-keys`; also linked from the
workspace settings page's Integration section). The key is shown once —
copy and store it.

**2. Connect the agent to the instance's MCP server** (HTTP mode,
default port 8081, path `/mcp` — the same ~90 `d6e_*` tools the d6e
chat agent uses):

```jsonc
// Cursor .cursor/mcp.json
{ "mcpServers": { "d6e": {
    "url": "http://<instance-host>:8081/mcp",
    "headers": { "Authorization": "Bearer d6e_YOUR_KEY" } } } }
```

```toml
# Codex CLI ~/.codex/config.toml
[mcp_servers.d6e]
url = "http://<instance-host>:8081/mcp"
bearer_token_env_var = "D6E_API_KEY"
```

```bash
# Claude Code
claude mcp add --transport http d6e http://<instance-host>:8081/mcp \
  --header "Authorization: Bearer d6e_YOUR_KEY"
```

Start with `d6e_list_workspaces` + `d6e_set_workspace`. Everything is
also callable as plain REST (`Authorization: Bearer d6e_...` +
`X-Workspace-ID` headers) if you prefer curl over MCP.

**3. What runs where while iterating:**

- **Workspace SQL** — remote, real DB: `d6e_sql` /
  `POST /api/v1/workspaces/{id}/sql`. Table access is deny-by-default;
  `POLICY_DENIED` means the workspace needs an allow policy (console →
  Admin → Policies, or `policies:` in template.yaml).
- **JS STFs** — do NOT emulate QuickJS locally; use
  `d6e_instant_run_stf` / `POST /api/v1/stfs/instant-run` with
  base64-encoded code to run drafts in the real runtime against real
  data (script style, `$input`, top-level `return` — see JS STF Code
  Style above).
- **Docker STFs** — the only locally-run piece: `docker build` + pipe
  the input JSON to `docker run -i`. Point `api_url`/`api_token` at the
  live instance for integration tests.
- **Drive files** — `SELECT path, drive_id FROM drive_files ...` (SQL
  projection kept in sync by the instance), then `d6e_read_drive_file`
  for content. Requires Drive sync enabled (Files page → Drive tab) and
  a SELECT policy on `drive_files`.
- **SaaS APIs (freee, Google Workspace, ...)** — `d6e_call_external_api`
  / `POST /api/v1/saas-proxy`; credentials stay server-side, connected
  once in console → Admin → SaaS integrations.

Full guide (per-agent MCP config, runtime environment details,
behaviour parity with the d6e chat agent, and the release steps for
plugins with a custom frontend — deployed redirect URI registration and
instance restart):
[docs/local-ai-development.md](https://github.com/d6e-ai/d6e-plugin-skills/blob/main/docs/local-ai-development.md)
([日本語版](https://github.com/d6e-ai/d6e-plugin-skills/blob/main/docs/local-ai-development.ja.md)).

## Distributing Your Plugin

Two distribution paths — most plugins only ever need the first one:

### Path 1: Install from URL (recommended default)

For development, testing, and team-internal distribution, no
registration is needed anywhere. Push the repository (public or
private, `template.yaml` at the root) and install it from the
workspace's **Plugins** page → **Install from URL** (workspace admin
required; see
[Testing Before Publishing](#testing-before-publishing-install-from-url)
above). Re-running Install from URL after a push updates the installed
resources in place — that is the whole release process for a
self-distributed plugin.

### Path 2: Marketplace listing via d6e-plugin-registry (only when you need public listing)

The marketplace does **not** discover plugins automatically. To appear in
every d6e instance's Browse tab, submit a pull request to
[d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry)
that adds:

1. `registry/{namespace}/{name}.yaml` — the plugin's detail page: name,
   namespace, localized `description`/`readme`/`changelog`, `category`,
   `icon`, and a `versions[]` array whose `manifestUrl` points at the
   raw `template.yaml` of a **tagged release**
   (e.g. `https://raw.githubusercontent.com/your-org/d6e-plugin-your-plugin/v1.0.0/template.yaml`)
2. A matching summary entry in `registry/index.yaml`
   (namespace, name, description, tier, category, icon, `latestVersion`)

The d6e team reviews the PR and assigns the tier (**Verified** = green
badge, listed first; **Unverified** = yellow badge). New versions and
removals are also registry pull requests: append to `versions[]` /
bump `latestVersion`, or delete the entry.

See [`docs/publishing.md`](../../docs/publishing.md) for complete YAML
examples of both registry files.

### How d6e Instances Find Listed Plugins

1. Each d6e instance fetches `registry/index.yaml` via the marketplace HTTP API (`https://marketplace.d6e.ai/api/registry`), which serves the canonical YAMLs stored in [d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry)
2. The Browse tab on the Plugins page displays all entries
3. When a user clicks Install, d6e fetches the version's `manifestUrl` → gets `template.yaml` → creates resources via Rust API

## Troubleshooting

### "template.yaml validation failed"

- Check YAML syntax (use a YAML linter)
- Verify all required fields are present
- Ensure `runtime` is one of: `js`, `wasm`, `docker`

### Install error: "Validation failed ... invalid_semver" on an Effect or STF

- Effect `version` in template.yaml must be plain semver **without** the
  `v` prefix (`1.0.0`, not `v1.0.0`) — or simply omit it to inherit the
  plugin version (recommended)
- The plugin-level `version` keeps its `v` prefix; the installer strips it
  before calling the API

### Install error: "STF source file not found" / fetch failed

- Verify the `source` path is relative to `template.yaml` location
- Check file exists and is not in `.gitignore`
- For private repositories, provide an access token in the install dialog

### "Docker image not accessible"

- Ensure the image is pushed to a public registry
- Use the full image reference including tag (e.g., `ghcr.io/org/image:v1.0.0`)
- The image must be pullable **by the d6e host**, not by your machine

### STF fails with "SyntaxError: Unexpected token 'export'"

- The STF source uses ES module syntax (`export default function ...`),
  but the runtime executes the file as a plain script wrapped in an async
  IIFE. Rewrite as top-level code: read from the `$input` global and end
  the file with a top-level `return { ... }` (see "JS STF Code Style")

### STF succeeds but its output is `undefined` / empty

- The file defines functions but never executes a top-level `return`.
  The wrapper returns whatever the top-level code returns — a file that
  only declares `function main() {...}` returns `undefined`

### Workflow runs but an STF receives `null` inputs

- The variable path in `input_mappings` is wrong. Paths must start with
  `$input`, `$sources.{step_name}`, or `$steps[n]` — e.g.
  `sources.fetch-data` (missing `$`) fails at execution, while
  `$input.mesage` (typo) silently resolves to `null`
- Run the workflow with `d6e_execute_workflow` and inspect which fields
  arrive as `null`

### Effect fires but the request body/headers are empty

- Effect mapping variables must use the `$.field` syntax; `$.` is
  stripped and the rest is resolved against the effect step's resolved
  input (built from its `input_mappings`)
- Verify the field you reference in `body_mappings` is actually mapped
  in the effect step's `input_mappings`

### Docker STF fails with POLICY_DENIED on SQL

- Plugin installation does NOT create SQL policies. After installing, create
  a policy group containing the installed STF (its id is visible on the
  workspace's STFs page) and add allow policies per table + operation —
  see the `d6e-docker-stf-development` skill
- Ask the workspace agent to do this, or use the MCP tools
  (`d6e_create_policy_group` with `stf_ids`, then `d6e_create_policy`)

### "Template prompt too long"

- Keep prompts focused and concise (recommended: under 2000 characters)
- Move detailed instructions to files that the AI can reference

### "Workflow STF/Effect not found"

- Verify `stf_name` / `effect_name` in workflow steps exactly match the `name` in the `stfs` / `effects` lists
- Names are case-sensitive

### Installed resources have unexpected names

- This is by design: resources are prefixed as
  `{namespace}/{plugin-name}/{resource-name}` at install time. Reference
  them by that full name when debugging in the console

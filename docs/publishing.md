# Distributing and Publishing d6e Plugins

There are two ways to get an plugin into a d6e workspace:

1. **Install from URL (manual install)** — recommended for development,
   testing, and any plugin you distribute yourself. No registration
   anywhere is needed.
2. **d6e Plugin Marketplace listing** — submit a pull request to the
   [d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry)
   repository. This is currently the **only** way to be listed in the
   marketplace.

> **Note**: the marketplace used to auto-discover plugins from public
> GitHub repositories tagged with the `d6e-plugin` topic. That pipeline no
> longer operates (the d6e-ai repositories are now managed on GitHub) and this
> guide assumes it does not exist. Automated discovery may return in
> some form in the future; until then, registry pull requests are the
> only listing path.

## Install from URL (Recommended for Development)

On your workspace's **Plugins** page in the d6e console, use
**Install from URL**:

1. Push your plugin repository (public or private) with `template.yaml` at the root
2. Open `https://{your-d6e-host}/{locale}/workspaces/{workspace_id}/plugins`
   (workspace **admin** role required)
3. Paste the repository or `template.yaml` URL — GitHub/GitLab web URLs
   are rewritten to raw/API URLs automatically
4. For private repositories, supply an access token in the dialog
5. If the plugin contains Docker STFs with `env` keys, the dialog prompts
   for their values; entered values are stored as encrypted STF secrets

Re-running Install from URL after pushing changes updates the installed
resources in place (new STF/effect versions, updated workflows). This
loop — edit `template.yaml`, push, re-install — is the normal
development workflow, and for plugins that only your own team uses it is
also the normal *distribution* workflow. You never need a marketplace
listing just to use an plugin.

## Marketplace Listing via d6e-plugin-registry

To make your plugin appear in every d6e instance's **Browse** tab, add it
to the registry data in
[d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry).

### Prerequisites

- Your plugin repository is reachable by the d6e instances that will
  install it (a public GitLab/GitHub repository, or one your instances
  have access to)
- A valid `template.yaml` at the repository root (validate it with
  `npx ajv-cli validate -s schema/template.schema.json -d template.yaml`)

### Step 1: Fork d6e-plugin-registry and add your plugin

Add **two** things in one pull request:

1. A per-plugin detail file `registry/{namespace}/{name}.yaml`:

```yaml
name: your-plugin
namespace: your-org
description:
  en-US: One-line description of what the plugin does.
  ja-JP: プラグインの内容を一行で説明。
tier: unverified # the d6e team assigns the final tier during review
repo: https://github.com/your-org/d6e-plugin-your-plugin
category: business # business | analytics | productivity | ...
icon: package # icon name shown in the Browse tab
screenshots: []
versions:
  - version: v1.0.0
    releaseDate: "2026-07-01"
    # Raw URL of the template.yaml for this version — this is what a
    # d6e instance downloads when a user clicks Install:
    manifestUrl: https://raw.githubusercontent.com/your-org/d6e-plugin-your-plugin/v1.0.0/template.yaml
    changelog:
      en-US: Initial release
      ja-JP: 初回リリース
    resources:
      stfs: 1
      files: 1
      effects: 0
      workflows: 1
readme:
  en-US: |
    ## Your Plugin
    Longer markdown description shown on the plugin's detail page.
  ja-JP: |
    ## あなたのプラグイン
    プラグイン詳細ページに表示される説明文。
```

2. A matching summary entry in `registry/index.yaml`:

```yaml
plugins:
  # ... existing entries ...
  - namespace: your-org
    name: your-plugin
    description:
      en-US: One-line description of what the plugin does.
      ja-JP: プラグインの内容を一行で説明。
    tier: unverified
    category: business
    icon: package
    latestVersion: v1.0.0
```

Point `manifestUrl` at a **tag** (as above) rather than a branch so the
listed version keeps installing the same manifest even after you push
new commits:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Step 2: Submit the pull request

Open a pull request against `main` of d6e-plugin-registry. The d6e team
reviews the plugin (schema validity, security, description quality) and
assigns the tier before merging.

| Tier | Badge | Meaning |
|------|-------|---------|
| **Verified** | Green | Reviewed by the d6e team; listed first |
| **Unverified** | Yellow | Listed, but not endorsed |

### How d6e Instances Find Your Plugin

1. Each d6e instance fetches the registry via the marketplace HTTP API
   (`https://marketplace.d6e.ai/api/registry`), which serves the
   canonical YAMLs stored in d6e-plugin-registry
2. The Browse tab on the Plugins page displays all `registry/index.yaml` entries
3. When a user clicks Install, d6e fetches the version's `manifestUrl`
   → gets `template.yaml` → creates the resources via the Rust API

## Publishing a New Version

1. Update the `version` field in `template.yaml` and tag the release
   (`git tag v1.1.0 && git push origin v1.1.0`)
2. Submit another merge request to d6e-plugin-registry that appends the
   new entry to your plugin's `versions[]` array and bumps `latestVersion`
   in `registry/index.yaml`

## Removing from Marketplace

Submit a merge request that deletes your plugin's
`registry/{namespace}/{name}.yaml` and its `registry/index.yaml` entry.

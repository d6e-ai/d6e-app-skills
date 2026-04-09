# Publishing to d6e App Marketplace

## Prerequisites

- A public GitHub repository containing your app
- A valid `template.yaml` at the repository root
- At least one tagged release (e.g., `v1.0.0`)

## Step 1: Prepare Your Repository

```
your-org/d6e-app-your-app/
├── template.yaml          # App manifest (required)
├── README.md              # App documentation (required)
├── CHANGELOG.md           # Version history (recommended)
├── stfs/                  # STF source files
├── files/                 # Bundled files
└── ...
```

## Step 2: Create a Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Step 3: Submit to Marketplace

1. Fork [d6e-ai/d6e-app-marketplace](https://github.com/d6e-ai/d6e-app-marketplace)
2. Create a registry entry: `registry/{namespace}/{name}.yaml`
3. Update `registry/index.yaml` to include your app
4. Open a Pull Request

### Registry Entry Format

```yaml
name: your-app
namespace: your-org
description: What your app does (max 200 chars)
tier: unverified
repo: https://github.com/your-org/d6e-app-your-app
category: business  # business | finance | development | example | other
icon: briefcase     # lucide icon name
versions:
  - version: v1.0.0
    releaseDate: "2026-04-09"
    manifestUrl: https://raw.githubusercontent.com/your-org/d6e-app-your-app/v1.0.0/template.yaml
    changelog: Initial release
    resources:
      stfs: 2
      files: 1
      effects: 0
      workflows: 1
readme: |
  ## Your App
  Description and usage instructions.
```

### index.yaml Entry

Add to the `apps` list:

```yaml
- namespace: your-org
  name: your-app
  description: What your app does
  tier: unverified
  category: business
  icon: briefcase
  latestVersion: v1.0.0
```

## Tier System

| Tier | Badge | Description |
|------|-------|-------------|
| **verified** | Green checkmark | Reviewed and approved by d6e team |
| **unverified** | Yellow warning | Community-submitted, not reviewed |

All new submissions start as `unverified`. Contact the d6e team for verification review.

## Publishing a New Version

1. Update `template.yaml` version
2. Tag and push: `git tag v1.1.0 && git push origin v1.1.0`
3. PR to marketplace: add new entry to `versions[]` array, update `latestVersion` in index.yaml

# Publishing to d6e App Marketplace

Apps are **automatically discovered** — no PRs or Issues needed for listing.

## Prerequisites

- A public GitHub repository containing your app
- A valid `template.yaml` at the repository root

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

## Step 2: Add the `d6e-app` Topic

Go to your GitHub repository → About (gear icon) → Topics → add **`d6e-app`**.

That's it! A scheduled GitHub Action on the [d6e-ai/d6e-app-registry](https://github.com/d6e-ai/d6e-app-registry) repository scans for all repos with this topic every 6 hours and auto-registers valid apps as **unverified**.

## Step 3 (optional): Tag a Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

The discovery script reads `template.yaml` from your default branch. Tagging helps users identify stable versions.

## How Discovery Works

1. GitHub Action runs on [d6e-ai/d6e-app-registry](https://github.com/d6e-ai/d6e-app-registry) every 6 hours
2. Searches GitHub for repositories with topic `d6e-app`
3. Fetches `template.yaml` from each repo's default branch
4. Validates the schema (name, namespace, version, description are required)
5. Auto-generates registry entries: `registry/index.yaml` and `registry/{namespace}/{name}.yaml`
6. `manifestUrl` is auto-derived from the repo URL and version

## Tier System

| Tier | Badge | How to get | Review |
|------|-------|-----------|--------|
| **Verified** | Green | PR to `verified-apps.yaml` | d6e team reviews |
| **Unverified** | Yellow | Add `d6e-app` topic | Automatic (schema validation only) |

## Requesting Verified Status

1. Ensure your app is already discovered
2. Submit a PR to [d6e-ai/d6e-app-registry](https://github.com/d6e-ai/d6e-app-registry) adding your app to `verified-apps.yaml`:
   ```yaml
   apps:
     - namespace: your-org
       name: your-app
   ```
3. The d6e team reviews your app and merges the PR

## Publishing a New Version

1. Update the `version` field in `template.yaml`
2. (Optional) Tag and push: `git tag v1.1.0 && git push origin v1.1.0`
3. Wait for the next discovery run (up to 6 hours) or trigger it manually

The discovery script detects version changes and adds new entries to the `versions[]` array.

## Removing from Marketplace

Remove the `d6e-app` topic from your repository. The next discovery run will remove it from the registry.

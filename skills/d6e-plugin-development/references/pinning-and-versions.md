# Workflow step pinning and version resolution

## Default: follow latest (`pin_version: false`)

Each workflow STF step stores a concrete `stf_version_id` (and each Effect
step stores an `effect_version_id`). That ID is the version recorded when the
workflow was created or last updated — it identifies the **parent STF/Effect
entity**, not necessarily the code that runs.

When `pin_version` is omitted or set to `false` (the default), the engine
loads that stored version to obtain the parent `stf_id` / `effect_id`, then
resolves the **latest version by `created_at`** at execution time. The stored
version ID is therefore a stable anchor; runtime behavior tracks the newest
STF/Effect code unless you opt into pinning.

Set `pin_version: true` only when you need reproducible, version-locked runs
(audits, regression tests, compliance).

## Plugin installer behavior

When a plugin is installed (or re-installed) from `template.yaml`, the
installer writes every bundled workflow step with `pin_version: false`:

- STF steps get the freshly upserted `stf_version_id` plus `pin_version: false`.
- Effect steps get the freshly upserted `effect_version_id` plus
  `pin_version: false`.

Because execution follows latest by default, re-installing a plugin immediately
picks up new STF/Effect code even before any re-pin logic runs.

## Re-install re-pin scope

After upserting STFs and Effects, the installer rebuilds **plugin-owned**
workflows (those declared in `template.yaml`) with the new version IDs.

A separate **re-pin** pass (step 5) scans **non-plugin** workflows in the
workspace. For each workflow whose STF or Effect steps still reference a
**superseded version ID** from a resource updated by this install, those step
IDs are rewritten to the new version IDs created during the install.

Important limits:

- Re-pin only touches steps whose `stf_version_id` / `effect_version_id`
  appears in the stale→new map built from this install. Steps pointing at
  unrelated resources are unchanged.
- **Forked or agent-copied workflows are not updated** when their steps no
  longer reference the old plugin version IDs (for example, the agent created
  independent STF/Effect copies with new IDs, or the fork already points at
  different entities). Only workflows that still carry the outdated plugin
  version IDs get rewritten.
- Re-pin failures are collected as install warnings; the install itself
  continues.

## Practical guidance for plugin authors

- Default `pin_version: false` is appropriate for most plugin workflows —
  users get bug fixes and improvements on the next execution without
  re-installing.
- Document breaking STF/Effect changes in your plugin `CHANGELOG.md` and bump
  semver accordingly; consumers on `pin_version: false` will pick up breaking
  changes automatically.
- If a workspace admin or agent forked a plugin workflow under a new name and
  replaced step references, expect that copy to stay on its own version IDs;
  re-install will not retroactively merge it back onto the plugin track.

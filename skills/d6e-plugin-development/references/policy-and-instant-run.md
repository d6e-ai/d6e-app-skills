# Policies, instant-run, and post-install checklist

SQL and table access in d6e are **deny-by-default**. Plugin installation creates
STFs, files, effects, and workflows — it **does not** create policies. See
[unsupported-and-phantom.md](unsupported-and-phantom.md) — `policies:` in
`template.yaml` is not implemented.

## Policy subject: User vs Stf (critical for testing)

The engine evaluates policies against a **subject** that depends on how the STF runs:

| Execution path | Policy subject | Typical caller |
|----------------|----------------|----------------|
| `d6e_instant_run_stf` / `POST .../stfs/instant-run` | **`PolicySubject::User`** | Agent pastes draft code; local dev |
| Workflow `stf_steps` (registered plugin STF) | **`PolicySubject::Stf`** | `d6e_execute_workflow`, console, production |

The **same SQL** in the same STF code can **pass in instant-run** (user policies)
and **fail in production** with `POLICY_DENIED` (STF has no allow policy on the
table). This is a common false confidence trap when developing plugins from a
local AI agent.

**Mitigation:**

1. After install, always attach **STF-scoped** policies to the installed STF id
   (not only your user).
2. Smoke-test with `d6e_execute_workflow` on the bundled workflow, not only
   `d6e_instant_run_stf`.
3. Document required policies in the plugin README for workspace admins.

## Post-install policy checklist

Run this after **Install from URL** or marketplace install (workspace admin or
agent with MCP):

1. **Resolve installed STF name** — resources are prefixed:
   `{namespace}/{plugin-name}/{stf-name}` (visible on workspace STFs page or via
   `d6e_list_stfs` / API).

2. **Create or update a policy group** containing that STF:
   - MCP: `d6e_create_policy_group` with `stf_ids: ["<stf-uuid>"]`
   - Or console → Admin → Policies → policy groups

3. **Add allow policies per table and operation** the STF needs:
   - MCP: `d6e_create_policy` on the group (e.g. `Select` on `my_table`,
     `Insert`/`Update` as required)
   - Match the operations your STF's `sql(...)` calls use

4. **Repeat for each STF** in the plugin that touches workspace SQL (including
   Docker STFs using `api_token` SQL).

5. **Drive / SaaS tables** — if the plugin reads `drive_files` or other mirrored
   tables, add explicit allows for those table names too.

6. **Verify under workflow subject** — execute the plugin workflow once and confirm
   no `POLICY_DENIED`.

DDL (`CREATE TABLE`, etc.) requires additional workspace DDL policy-group
settings; table DML is the usual plugin need.

## What the installer does not do

- No automatic policy creation from manifest
- No inheritance from the installing admin's user policies to the STF
- No policy updates on re-install (existing groups stay as-is; new STF versions
  may need group membership verified)

## Agent vs admin workflow

During [local AI development](../../../docs/local-ai-development.md), the coding
agent often runs SQL and instant-run STFs as **the user**. Before declaring a
plugin ready:

- [ ] Policy group includes **installed STF id(s)**
- [ ] Allow policies cover every table/op used in STF code
- [ ] Tested via **workflow execute**, not instant-run alone
- [ ] README lists required policies for production admins

Cross-link: Docker STF policy patterns in the **d6e-docker-stf-development**
skill; plugin phantom `policies:` warning in
[unsupported-and-phantom.md](unsupported-and-phantom.md).

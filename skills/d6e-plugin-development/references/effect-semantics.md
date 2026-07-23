# Effect HTTP semantics and Fetch comparison

Effect steps call external HTTP APIs from workflow `effect_steps`. Their behavior
differs sharply from **Fetch** input steps and from what many authors assume about
HTTP success, timeouts, and workflow return values.

Related:

- [timeouts.md](timeouts.md) — Fetch 60 s cap vs Effect no timeout; STF `output_schema`
- [unsupported-and-phantom.md](unsupported-and-phantom.md) — phantom fields and schema storage
- [cross-package-recipes.md](cross-package-recipes.md) — when to use Effect vs MCP vs Docker

## HTTP status codes — not checked

The Effect HTTP client **does not treat 4xx or 5xx as failure**. As long as the
request completes without a transport error, the Effect step **succeeds** and the
workflow continues.

Authors who need fail-fast on bad status must:

- Use a **Fetch** input step (non-2xx fails the step) for read-only JSON loads, or
- Post-process in an **STF** step if the Effect response is mapped forward (Effects
  do not surface status to `$steps[n]` — see return value below), or
- Use **MCP/API** from an agent outside the workflow.

## Response body parsing

- **JSON** responses are parsed into a value attached to the internal Effect result.
- **Non-JSON** bodies (HTML, plain text, binary) resolve to **`null`** for parsed
  body purposes — there is no raw string or bytes passthrough to later STF mappings
  from the Effect step output in the workflow result.

For binary or large non-JSON payloads, use [saas-and-downloads.md](saas-and-downloads.md)
or [cross-package-recipes.md](cross-package-recipes.md) instead of Effect.

## Header mappings — non-string variables become empty string

In `header_mappings`, values starting with `$.` resolve against the effect step's
input object. If the resolved value is **not a string** (number, object, array,
boolean, null), the engine **silently substitutes an empty string** for that
header — no error.

Verify types in the effect step's `input_mappings` or coerce in an earlier STF
step if headers must be non-empty.

## Workflow return value — last STF only

The workflow's **returned result** is the output of the **last STF step** only.

- **Effect step results are discarded** from the workflow return value — they are
  not merged into `$steps[n]` and do not become the workflow output.
- Effect steps still run (after STF steps, in parallel with each other), but callers
  of `d6e_execute_workflow` only see the final STF output.

Design plugins so the meaningful payload is produced by the last STF, or accept
that Effect steps are side effects (notifications, webhooks) only.

## Fetch input step vs Effect step

| Aspect | Input `Fetch` | Effect HTTP |
|--------|---------------|-------------|
| When it runs | Input phase (parallel with other input steps) | After all STF steps |
| HTTP success | **Fails on non-2xx** | **Succeeds on any status** if transport OK |
| Timeout | Yes — **`timeout_secs` clamped to 60 s max** | **No platform timeout** |
| Redirects | **Not followed** | Default client behavior (typically follows) |
| Body size | **5 MB cap** | No same 5 MB cap documented for Effect |
| Body in workflow | Available as `$sources.{name}` | **Not in workflow return**; internal only |
| JSON-only | Intended for JSON; parsing expectations apply | Non-JSON → **`null`** parsed body |
| Credentials | Public URL only (SSRF rules) | Effect URL from effect definition |

Use **Fetch** when you need a failed HTTP status to stop the workflow and JSON
available to STFs via `$sources`. Use **Effect** for fire-and-forget integrations
where status and response body are not part of the workflow result.

## Practical checklist

- [ ] Do not assume Slack/webhook Effect failures on 4xx/5xx — add STF checks only
      if you have another path to observe status (usually you do not).
- [ ] Map notification payloads in the **last STF** if the workflow consumer needs
      a summary of external calls.
- [ ] Prefer Fetch for config/data loads with a 60 s / 5 MB budget.
- [ ] Expect **indefinite hang** risk on slow Effect upstreams — see [timeouts.md](timeouts.md).

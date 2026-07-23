# Timeouts and output validation in plugin workflows

Related:

- [effect-semantics.md](effect-semantics.md) — Effect HTTP has no timeout; status codes not checked
- [unsupported-and-phantom.md](unsupported-and-phantom.md) — STF `input_schema` stored but not validated at execute
- [cross-package-recipes.md](cross-package-recipes.md) — Fetch vs Effect vs MCP for external data

## Input Fetch steps (`input_steps` with `type: Fetch`)

Workflow input steps can fetch external HTTP endpoints at execution time:

```yaml
input_steps:
  - name: load-config
    source:
      type: Fetch
      url: "https://example.com/config.json"
      method: GET
      timeout_secs: 30
```

### Timeout clamp

The `timeout_secs` field is honored but **clamped to a maximum of 60 seconds**
(`MAX_FETCH_TIMEOUT_SECS` in the API engine). Values above 60 behave as 60;
omitted values use the engine default handling for the request builder.

Other Fetch limits (for plugin authors to keep in mind):

- Response body size is capped at **5 MB**.
- Only `http` / `https` URLs are allowed; private/reserved IP targets are
  blocked (SSRF protection).
- Redirects are not followed.

## Effect HTTP steps (`effect_steps`)

Effects call external APIs through the workflow engine's HTTP client. Unlike
Fetch input steps, the Effect client is built with **`reqwest::Client::new()`
and no `.timeout(...)`** — there is no platform-enforced wall-clock cap on
Effect HTTP calls.

Implications:

- A slow or hanging upstream API can block the Effect step (and therefore the
  workflow) indefinitely from the engine's perspective.
- Do not assume Effect calls inherit Fetch's 60-second limit.
- Prefer idempotent Effect targets, reasonable provider-side limits, and
  defensive STF preprocessing when latency matters.

See [effect-semantics.md](effect-semantics.md) for full Effect vs Fetch behavior
(status codes, return value, non-JSON bodies).

For comparison:

| Mechanism | Timeout configured? | Typical use |
|-----------|----------------------|-------------|
| Input `Fetch` | Yes — clamped to 60 s max | Load JSON/config at workflow start |
| Effect HTTP | **No** | Call Slack, webhooks, REST APIs from effect steps |
| Docker STF | Separate env (`STF_DOCKER_TIMEOUT_SECS`) | Containerized logic |

## STF `input_schema` vs `output_schema`

STF `input_schema` may be stored on the version record but is **not validated**
at workflow execution time. Do not rely on it for runtime guards — validate in
STF code or document expected input shape.

Only **`output_schema`** is enforced at execute time (below).

## STF `output_schema` validation

If an STF version defines `output_schema` (JSON Schema), the engine validates
the STF's return value **immediately after that step runs**. A validation
failure aborts the **entire workflow** with a runtime error — later STF steps
and Effect steps do not execute.

Plugin authors should:

- Keep `output_schema` aligned with the STF's actual return shape across
  versions, or omit it until the contract is stable.
- Treat schema mismatch as a hard failure (not a warning) when testing with
  `d6e_execute_workflow` or Install from URL smoke tests.

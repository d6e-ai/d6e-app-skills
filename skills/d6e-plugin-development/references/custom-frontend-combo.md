# Combining plugins with a custom frontend

A d6e Plugin packages workspace resources (`template.yaml` → STFs, Effects,
workflows, files, template prompt). A **custom frontend** is a separately
deployed web app that authenticates users and proxies calls to the d6e
instance APIs. Many products ship both: the plugin defines backend behavior;
the frontend provides the product UI.

## Division of responsibility

| Piece | Owned by | Installed / deployed how |
|-------|----------|---------------------------|
| Plugin (`template.yaml`) | Plugin repository | Console → **Install from URL** (or marketplace) |
| Custom frontend | Frontend repository | Deploy to Vercel, Cloudflare, etc. |
| d6e instance | Operator | Docker / managed host |

The plugin skill covers manifest authoring and Install from URL. Auth,
session cookies, and `/api/*` proxy routes are documented in
**[d6e-custom-frontend-skills](https://github.com/d6e-ai/d6e-custom-frontend-skills)** —
start with
[`docs/frontend-and-instance.md`](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/docs/frontend-and-instance.md)
and the `d6e-auth-integration` / `d6e-workspace-api-client` skills.

## Release steps when both exist

After the plugin itself is verified via Install from URL:

1. **Develop the frontend** against the live instance. OAuth2 login with
   **loopback redirect URIs** (`localhost`, `127.0.0.0/8`, `[::1]` — any
   port, any path) works without registration on d6e ≥ v0.20.1.
2. **Deploy the frontend** to its production URL.
3. **Register the deployed redirect URI** (e.g.
   `https://your-app.example.com/auth/callback`) in **both** places:
   - **[https://www.d6e.ai](https://www.d6e.ai)** — franchise owner/admin
     self-service at `https://www.d6e.ai/{locale}/account/franchise` (client
     redirect URI list).
   - **The d6e instance** — append the same URI to `ALLOWED_REDIRECT_URIS` in
     the instance `.env`.
4. **Redeploy or restart the d6e instance** so the `.env` change takes effect
   (e.g. `docker compose up -d` on the instance host). Coordinate with the
   instance operator — this is the only release step that touches the instance
   itself.

Skipping instance restart after updating `ALLOWED_REDIRECT_URIS` is a common
cause of "redirect_uri mismatch" errors in production while loopback dev still
works.

## Checklist (plugin + frontend)

- [ ] Plugin installed and workflows exercised (`d6e_execute_workflow` or console)
- [ ] Frontend server routes proxy d6e with server-held tokens (never expose
      Bearer tokens to the browser)
- [ ] Binary downloads use saas-proxy-download → same-origin streaming proxy
      (see [saas-and-downloads.md](./saas-and-downloads.md))
- [ ] Production redirect URI registered on **www.d6e.ai** and in instance
      `ALLOWED_REDIRECT_URIS`
- [ ] Instance restarted/redeployed after env change
- [ ] End-to-end login and one critical workflow tested on the deployed URL

See also the custom-frontend section in
[`docs/local-ai-development.md`](../../../docs/local-ai-development.md).

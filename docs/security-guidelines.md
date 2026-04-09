# Security Guidelines for d6e App Authors

## Template Prompt Safety

The `template_prompt` field is injected into the AI agent's system context. Malicious prompts can cause significant damage.

### Do

- Keep prompts focused on the app's domain
- Use clear, specific instructions
- Test prompts to ensure they don't cause unintended behavior

### Do NOT

- Instruct the AI to bypass user confirmation for destructive operations
- Include instructions to execute arbitrary SQL without user approval
- Reference external URLs for dynamic prompt loading (indirect prompt injection risk)
- Include instructions to call external APIs with user credentials

## Credential Management

- **Never** hardcode API keys, tokens, or passwords in `template.yaml` or bundled files
- Use d6e's `saasCredential` system for OAuth/API tokens
- Docker STFs should receive credentials via environment variables at runtime, not in the manifest

## Docker Image Security

- Use pinned image tags (e.g., `ghcr.io/org/image:v1.0.0`), never `latest`
- Use official base images (e.g., `python:3.12-slim`, `node:22-slim`)
- Run containers as non-root users
- Minimize image size and attack surface

## File Safety

- Bundled files become part of the workspace context
- Do not include executable code disguised as data files
- Review all file contents before publishing

## Review Process

- All marketplace submissions start as `unverified`
- The d6e team reviews verified apps for security compliance
- Report security issues to security@d6e.ai

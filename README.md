# d6e App Skills

[![Skills](https://img.shields.io/badge/skills.sh-d6e--app--skills-blue)](https://skills.sh)
[![GitHub](https://img.shields.io/github/stars/d6e-ai/d6e-app-skills?style=social)](https://github.com/d6e-ai/d6e-app-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Agent Skills for developing and publishing d6e Apps — reusable workspace configurations for the d6e platform.

## What is This?

This repository contains **Agent Skills** that teach Claude and Cursor how to help developers create d6e App packages. A d6e App bundles prompts, STFs, files, effects, and workflows into a distributable `template.yaml` manifest.

## Available Skills

### [d6e App Development](./skills/d6e-app-development/SKILL.md)

Guides AI agents through creating d6e Apps, including:

- `template.yaml` manifest structure and all fields
- STF definitions (JS, WASM, Docker runtimes)
- File, effect, and workflow packaging
- Prompt separation (template_prompt vs custom_prompt)
- Publishing to the d6e App Marketplace
- Security best practices

## Installation

### Quick Install (Recommended)

```bash
npx skills add d6e-ai/d6e-app-skills
```

### Manual Installation

#### For Cursor

1. Clone the repository:
   ```bash
   git clone https://github.com/d6e-ai/d6e-app-skills.git
   ```

2. Add to Cursor:
   - Open Cursor Settings
   - Navigate to "Features" > "Agent Skills"
   - Add skill directory: `/path/to/d6e-app-skills/skills/d6e-app-development`

3. Verify: type `@skills` in Composer to see `d6e-app-development`

#### For Claude Code

Reference the skill document in your prompts:
```
Using @skills/d6e-app-development/SKILL.md, create a d6e App for [your use case].
```

## Documentation

- **[template.yaml Specification](./docs/template-yaml-spec.md)** — Full field reference
- **[Security Guidelines](./docs/security-guidelines.md)** — Security best practices for app authors
- **[Publishing Guide](./docs/publishing.md)** — How to publish to the marketplace

## Examples

### [hello-world](./examples/hello-world/)

A minimal d6e App with a greeting STF and template prompt:

```yaml
name: hello-world
namespace: d6e
version: v0.1.0
description: A minimal d6e App that demonstrates the template structure.

template_prompt: |
  You are a friendly greeting assistant.

stfs:
  - name: hello
    runtime: js
    description: Returns a personalized greeting message
    source: stfs/hello.js
```

## Schema Validation

Use the JSON Schema for editor autocomplete and validation:

```bash
npx ajv-cli validate -s schema/template.schema.json -d template.yaml
```

## Related Resources

- [d6e Platform](https://github.com/d6e-ai/d6e) — Main d6e repository
- [d6e App Marketplace](https://github.com/d6e-ai/d6e-app-marketplace) — App catalog and registry
- [d6e Docker STF Skills](https://github.com/d6e-ai/d6e-docker-stf-skills) — Skills for Docker STF development
- [skills.sh](https://skills.sh) — The Open Agent Skills Ecosystem

## Contributing

1. Fork the repository
2. Make changes (documentation improvements, new examples, bug fixes)
3. Create a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

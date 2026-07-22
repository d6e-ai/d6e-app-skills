# d6e Plugin Skills

[![Skills](https://img.shields.io/badge/skills.sh-d6e--plugin--skills-blue)](https://skills.sh/d6e-ai/d6e-plugin-skills/d6e-plugin-development)
[![GitHub](https://img.shields.io/badge/GitHub-d6e--ai%2Fd6e--plugin--skills-181717?logo=github)](https://github.com/d6e-ai/d6e-plugin-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Agent Skills for developing and publishing d6e Plugins — reusable workspace configurations for the d6e platform.

d6eプラグインの開発・公開を支援するAgent Skillsです。d6eプラットフォーム向けの再利用可能なワークスペース設定をパッケージ化できます。

## What is This? / これは何？

This repository contains **Agent Skills** that teach Claude and Cursor how to help developers create d6e Plugin packages. A d6e Plugin bundles prompts, STFs, files, effects, and workflows into a distributable `template.yaml` manifest.

このリポジトリには、Claude や Cursor が開発者の d6e プラグイン作成を支援するための **Agent Skills** が含まれています。d6e プラグインは、プロンプト・STF・ファイル・エフェクト・ワークフローを `template.yaml` マニフェストにまとめた配布可能なパッケージです。

## Available Skills / 利用可能なスキル

### [d6e Plugin Development](./skills/d6e-plugin-development/SKILL.md)

Guides AI agents through creating d6e Plugins, including:

- `template.yaml` manifest structure and all fields
- STF definitions (JS, WASM, Docker runtimes)
- File, effect, and workflow packaging
- Prompt separation (template_prompt vs custom_prompt)
- Distribution: manual install (Install from URL), or automatic marketplace discovery from public GitHub repositories tagged `d6e-plugin`; verified status is managed in d6e-plugin-registry
- Security best practices

AIエージェントによる d6e プラグイン作成をガイドします:

- `template.yaml` マニフェストの構造と全フィールド
- STF定義（JS、WASM、Docker ランタイム）
- ファイル、エフェクト、ワークフローのパッケージング
- プロンプトの分離（template_prompt vs custom_prompt）
- 配布: 手動インストール（Install from URL）、または `d6e-plugin` トピックを付けた公開GitHubリポジトリの自動マーケットプレイス掲載。認証済みステータスは d6e-plugin-registry で管理
- セキュリティのベストプラクティス

## Installation / インストール

```bash
npx skills add d6e-ai/d6e-plugin-skills --skill d6e-plugin-development
```

The GitHub-style `owner/repo` shorthand is supported by the skills CLI.
>
GitHub 形式の `owner/repo` 省略記法も利用できます。

After installation, type `@skills` in Cursor Composer to verify `d6e-plugin-development` is available.

インストール後、Cursor Composer で `@skills` と入力し、`d6e-plugin-development` が利用可能であることを確認してください。

## Documentation / ドキュメント

- **[template.yaml Specification](./docs/template-yaml-spec.md)** — Full field reference / 全フィールドリファレンス
- **[Security Guidelines](./docs/security-guidelines.md)** — Security best practices for plugin authors / セキュリティガイドライン
- **[Publishing Guide](./docs/publishing.md)** — Manual install (recommended for development) and marketplace listing via d6e-plugin-registry / 手動インストール（開発時推奨）と d6e-plugin-registry 経由のマーケットプレイス掲載
- **[Local AI Agent Development](./docs/local-ai-development.md)** ([日本語版](./docs/local-ai-development.ja.md)) — Develop and test plugins from Codex / Claude Code / Cursor against a live d6e instance (auth, MCP, SQL, Drive, SaaS proxy, STF instant-run) / ローカルAIエージェント（Codex / Claude Code / Cursor）からd6eインスタンスに接続して開発・テストする方法

## Examples / サンプル

The `examples/` directory contains complete d6e Plugin packages:

`examples/` ディレクトリには完全な d6e プラグインパッケージが含まれています:

| Plugin | Description | 説明 |
|-----|-------------|------|
| [accounting-assistant](./examples/accounting-assistant/) | Journal entry validation with chart of accounts | 勘定科目表を使った仕訳検証 |
| [sales-analytics](./examples/sales-analytics/) | Sales KPI aggregation with Slack alerts | 売上KPI集計とSlackアラート |
| [data-quality-checker](./examples/data-quality-checker/) | Configurable dataset validation | 設定可能なデータセット検証 |
| [meeting-notes-summarizer](./examples/meeting-notes-summarizer/) | Action items and decisions extraction | アクションアイテムと決定事項の抽出 |

### Quick Example / 簡単な例

```yaml
name: hello-world
namespace: d6e
version: v0.1.0
description:
  en-US: A minimal d6e Plugin that demonstrates the template structure.
  ja-JP: テンプレート構造を示す最小限のd6eプラグイン。

template_prompt: |
  You are a friendly greeting assistant.

stfs:
  - name: hello
    runtime: js
    description: Returns a personalized greeting message
    source: stfs/hello.js
```

## Schema Validation / スキーマバリデーション

Use the JSON Schema for editor autocomplete and validation:

JSON Schema をエディタの自動補完とバリデーションに使用できます:

```bash
npx ajv-cli validate -s schema/template.schema.json -d template.yaml
```

## Related Resources / 関連リソース

- [d6e Platform](https://github.com/d6e-ai/d6e) — Main d6e repository / d6e メインリポジトリ
- [d6e Plugin Marketplace](https://github.com/d6e-ai/d6e-plugin-marketplace) — Plugin catalog website / プラグインカタログサイト
- [d6e Plugin Registry](https://github.com/d6e-ai/d6e-plugin-registry) — Marketplace listing data; submit a PR here to get listed / マーケットプレイス掲載データ（掲載はここへのPRで申請）
- [d6e Docker STF Skills](https://github.com/d6e-ai/d6e-docker-stf-skills) — Skills for Docker STF development / Docker STF 開発スキル
- [skills.sh](https://skills.sh) — The Open Agent Skills Ecosystem / オープンAgent Skillsエコシステム

## Contributing / コントリビューション

1. Fork the repository / リポジトリをフォーク
2. Make changes (documentation improvements, new examples, bug fixes) / 変更を作成（ドキュメント改善、新しいサンプル、バグ修正）
3. Create a Pull Request / プルリクエストを作成

## License

MIT License — see [LICENSE](LICENSE) for details.

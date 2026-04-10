# d6e App Skills

[![Skills](https://img.shields.io/badge/skills.sh-d6e--app--skills-blue)](https://skills.sh)
[![GitHub](https://img.shields.io/github/stars/d6e-ai/d6e-app-skills?style=social)](https://github.com/d6e-ai/d6e-app-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Agent Skills for developing and publishing d6e Apps — reusable workspace configurations for the d6e platform.

d6eアプリの開発・公開を支援するAgent Skillsです。d6eプラットフォーム向けの再利用可能なワークスペース設定をパッケージ化できます。

## What is This? / これは何？

This repository contains **Agent Skills** that teach Claude and Cursor how to help developers create d6e App packages. A d6e App bundles prompts, STFs, files, effects, and workflows into a distributable `template.yaml` manifest.

このリポジトリには、Claude や Cursor が開発者の d6e アプリ作成を支援するための **Agent Skills** が含まれています。d6e アプリは、プロンプト・STF・ファイル・エフェクト・ワークフローを `template.yaml` マニフェストにまとめた配布可能なパッケージです。

## Available Skills / 利用可能なスキル

### [d6e App Development](./skills/d6e-app-development/SKILL.md)

Guides AI agents through creating d6e Apps, including:

- `template.yaml` manifest structure and all fields
- STF definitions (JS, WASM, Docker runtimes)
- File, effect, and workflow packaging
- Prompt separation (template_prompt vs custom_prompt)
- Publishing to the d6e App Marketplace
- Security best practices

AIエージェントによる d6e アプリ作成をガイドします:

- `template.yaml` マニフェストの構造と全フィールド
- STF定義（JS、WASM、Docker ランタイム）
- ファイル、エフェクト、ワークフローのパッケージング
- プロンプトの分離（template_prompt vs custom_prompt）
- d6e App Marketplace への公開
- セキュリティのベストプラクティス

## Installation / インストール

```bash
npx skills add https://github.com/d6e-ai/d6e-app-skills --skill d6e-app-development
```

After installation, type `@skills` in Cursor Composer to verify `d6e-app-development` is available.

インストール後、Cursor Composer で `@skills` と入力し、`d6e-app-development` が利用可能であることを確認してください。

## Documentation / ドキュメント

- **[template.yaml Specification](./docs/template-yaml-spec.md)** — Full field reference / 全フィールドリファレンス
- **[Security Guidelines](./docs/security-guidelines.md)** — Security best practices for app authors / セキュリティガイドライン
- **[Publishing Guide](./docs/publishing.md)** — How to publish to the marketplace / マーケットプレイスへの公開方法

## Examples / サンプル

The `examples/` directory contains complete d6e App packages:

`examples/` ディレクトリには完全な d6e アプリパッケージが含まれています:

| App | Description | 説明 |
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
  en-US: A minimal d6e App that demonstrates the template structure.
  ja-JP: テンプレート構造を示す最小限のd6eアプリ。

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
- [d6e App Marketplace](https://github.com/d6e-ai/d6e-app-marketplace) — App catalog and registry / アプリカタログとレジストリ
- [d6e Docker STF Skills](https://github.com/d6e-ai/d6e-docker-stf-skills) — Skills for Docker STF development / Docker STF 開発スキル
- [skills.sh](https://skills.sh) — The Open Agent Skills Ecosystem / オープンAgent Skillsエコシステム

## Contributing / コントリビューション

1. Fork the repository / リポジトリをフォーク
2. Make changes (documentation improvements, new examples, bug fixes) / 変更を作成（ドキュメント改善、新しいサンプル、バグ修正）
3. Create a Pull Request / プルリクエストを作成

## License

MIT License — see [LICENSE](LICENSE) for details.

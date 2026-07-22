# ローカル AI エージェントで d6e Plugin を開発する

English version: [local-ai-development.md](./local-ai-development.md)

このガイドは、**ローカルの AI コーディングエージェント**（Codex CLI、
Claude Code、Cursor など、シェルコマンドの実行や MCP サーバーへの接続が
できるエージェント）から**稼働中の d6e インスタンス**に接続して d6e
Plugin を開発・テストする方法を説明します。最後の仕上げまで、d6e への
デプロイは一切不要です。

これを可能にしている核心は、**d6e の AI エージェントができることはすべて
インスタンスの公開 HTTP API として提供されている**という事実です。d6e 内
のチャットエージェントは、あなたのラップトップから呼べるのと同じ MCP
サーバー・同じ REST API と会話しています。「d6e の中でしか使えない機能」
は存在しません。

```
┌────────────────────┐        ┌────────────────────────────────────┐
│ ローカル AI         │        │ d6e インスタンス (https://…)       │
│ エージェント        │  MCP   │  ┌──────────┐   ┌──────────────┐  │
│ (Codex / Claude     │───────▶│  │ MCP :8081│──▶│ Rust API      │  │
│  Code / Cursor)     │  REST  │  └──────────┘   │  /api/v1/*    │  │
│                     │───────▶│                 │  SQL / STF /  │  │
│  Docker STF 開発は  │        │                 │  Drive / SaaS │  │
│  ローカル Docker    │        │                 └──────┬───────┘  │
└────────────────────┘        │            PostgreSQL ◀┘          │
                               └────────────────────────────────────┘
```

| テストしたいもの | 実行場所 | 方法 |
|---|---|---|
| ワークスペース SQL（テーブル、クエリ） | リモート（実 DB） | `POST /api/v1/workspaces/{id}/sql` または MCP `d6e_sql` |
| QuickJS（`runtime: js`）STF のロジック | リモート（実 QuickJS ランタイム） | `POST /api/v1/stfs/instant-run` または MCP `d6e_instant_run_stf` |
| Docker STF のロジック | **ローカル** `docker run` | stdin/stdout JSON 契約。統合テストは `api_url` を実インスタンスに向ける |
| Google Drive のファイル | リモート（同期ミラー） | `SELECT * FROM drive_files` + `d6e_read_drive_file` |
| SaaS 呼び出し（freee、Google Workspace など） | リモート（サーバー管理の認証情報） | `POST /api/v1/saas-proxy` または MCP `d6e_call_external_api` |
| ワークフロー | リモート | `POST /api/v1/workflows/{id}/execute` または MCP `d6e_execute_workflow` |
| テンプレートプロンプトの挙動 | ローカルエージェント ≈ d6e チャット | [d6e チャットエージェントとの挙動差](#9-d6e-チャットエージェントとの挙動差)参照 |

本文中のプレースホルダ:

- `D6E_BASE_URL` — 対象インスタンス。例: `https://cauchye.d6e.ai`
- `WORKSPACE_ID` — ワークスペース設定ページ（`${D6E_BASE_URL}/{locale}/workspaces/{id}/settings`）で確認できる UUID

アカウント関連の操作（ログイン、リダイレクト URI の登録）は d6e の
中央サイト [https://www.d6e.ai](https://www.d6e.ai/ja-JP) で行います —
これ以外の URL はありません。

## 本ガイドの範囲: Plugin であって、カスタムフロントエンドではない

d6e は同じ API 境界線の両側から拡張できますが、本ガイドが扱うのは
前者のみです。

- **Plugin** は*ワークスペースの中身* — `template_prompt`、テーブル/
  ポリシー、STF、ワークフロー、Effect — を `template.yaml` に
  パッケージ化したもので、インスタンスの**中に**インストールされ、
  インスタンス**によって**実行されます。ユーザーは組み込みの d6e
  コンソールとチャットを通じて利用します。本ドキュメントの残りが
  開発・テストするのはこれです。
- **カスタムフロントエンド**は独立してデプロイされる Web アプリ
  （独自ドメイン・独自ホスティング）で、
  [https://www.d6e.ai](https://www.d6e.ai/ja-JP) でユーザーを
  ログインさせ、インスタンスの公開 API — 以下で使うものと同じ API —
  を通じてワークスペースを操作します。d6e にインストールされるものでは
  なく、通常は Plugin が用意したものを*消費*する側です。

後者を作る場合、あるいはフロントエンド・インスタンス・中央アカウント
サイトの関係が曖昧な場合は、まず d6e-custom-frontend-skills リポジトリの
[カスタムフロントエンドと d6e インスタンスの関係](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/docs/frontend-and-instance.ja.md)
を読んでから、ワークスペース側の作業のために本ガイドへ戻ってきてください。

---

## 1. API キーの取得（初回のみ、約 1 分）

すべての `/api/v1/*` エンドポイントは `Authorization: Bearer <token>` を
受け付けます。ローカル開発には長命の **API キー**（`d6e_…`）を使います。
d6e コンソールから作成できます:

1. コンソール（`${D6E_BASE_URL}`）にログインします。
2. ヘッダーのアバター →「**APIキー**」（`/{locale}/user/api-keys`）を
   開きます。ワークスペース設定ページの連携セクション（クライアント ID・
   ワークスペース ID の隣）からも同じページへのリンクがあります。
3. キーを作成し、表示された `d6e_…` の値をコピーします — **表示は一度
   きり**です。有効期限は省略可能で、省略すると無期限のキーになります。

API キーはワークスペース毎ではなく**あなたのユーザーアカウントに紐づき**、
あなたのワークスペースメンバーシップを引き継ぎます。以降はすべて
`Authorization: Bearer d6e_…` を使い、ワークスペーススコープのエンド
ポイントには `X-Workspace-ID: ${WORKSPACE_ID}` ヘッダを付けます。

動作確認:

```bash
curl -s ${D6E_BASE_URL}/api/v1/workspaces -H "Authorization: Bearer ${D6E_API_KEY}"
```

---

## 2. エージェントをインスタンスの MCP サーバーに接続する（推奨）

インスタンスは d6e MCP サーバーを HTTP モードで実行しています
（デフォルトポート **8081**、パス `/mcp`）。これは *d6e チャット
エージェントが使っているのと同じサーバー・同じ約 90 個の `d6e_*`
ツール*です。ローカルエージェントをここに接続すれば、ホストされた
エージェントとツール単位で完全に同等になります: `d6e_sql`、
`d6e_list_files`、`d6e_search_files`、`d6e_read_drive_file`、
`d6e_call_external_api`、`d6e_instant_run_stf`、`d6e_execute_workflow`、
`d6e_create_stf` など。

> 注意: 現行のデプロイ構成ではポート 8081 は素の HTTP です（リバース
> プロキシが TLS 終端するのはコンソールと `/api/v1` のみ）。API キーの
> 扱いには注意し、気になる場合は SSH トンネルを使ってください。

**Codex CLI**（`~/.codex/config.toml`）:

```toml
[mcp_servers.d6e]
url = "http://<instance-host>:8081/mcp"
# キーを環境変数から読む（設定ファイルに残さない）:
bearer_token_env_var = "D6E_API_KEY"
# ...またはインラインで（ファイルの権限管理に注意）:
# http_headers = { "Authorization" = "Bearer d6e_YOUR_API_KEY" }
```

**Claude Code**:

```bash
claude mcp add --transport http d6e http://<instance-host>:8081/mcp \
  --header "Authorization: Bearer d6e_YOUR_API_KEY"
```

**Cursor**（プロジェクトの `.cursor/mcp.json`、またはグローバル設定）:

```json
{
  "mcpServers": {
    "d6e": {
      "url": "http://<instance-host>:8081/mcp",
      "headers": { "Authorization": "Bearer d6e_YOUR_API_KEY" }
    }
  }
}
```

接続後、エージェントはまず `d6e_list_workspaces` を一度呼び、次に
`d6e_set_workspace`（または各呼び出しで `workspace_id` を指定）してから
ワークスペーススコープのツールを使ってください。

MCP を使いたくない場合も、以降の各セクションに生の REST 相当の呼び出しを
載せています — `curl` でも全く同じことができます。

---

## 3. ワークスペース SQL

ワークスペースのデータベースはリモートにあります。ローカルに再現する
ものはありません。

```bash
curl -s -X POST ${D6E_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/sql \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "X-Workspace-ID: ${WORKSPACE_ID}" \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT id, status FROM my_table LIMIT 10"}'
# -> { "rows": [...], "executed_sql": "SELECT ... FROM user_data.ws_<uuid>_my_table ..." }
```

裸のテーブル名は、d6e エージェントの場合と全く同じように、ワークスペース
のプレフィックス付きテーブル
（`user_data.ws_<ハイフンをアンダースコアにした uuid>_<name>`）に解決
されます。ワークスペースのテーブル一覧を見るには:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'user_data'
  AND table_name LIKE 'ws_<workspace-uuid-with-underscores>_%';
```

**ポリシーは d6e エージェントと全く同じようにあなたにも適用されます。**
テーブルアクセスはデフォルト拒否です。`POLICY_DENIED` /「No policy found
for Select operation on table '…'」エラーは、そのテーブル・その主体に
対する許可ポリシーがまだワークスペースに無いことを意味します —
コンソール（管理 → ポリシー）か `d6e_create_policy` /
`d6e_create_policy_group` で作成するか、`template.yaml` の `policies:`
セクションで配布してください。DDL（`CREATE TABLE` など）はさらに
ワークスペースの DDL ポリシーグループ設定で制御されます。

---

## 4. Google Drive のファイル — `ls` 相当の探索

ワークスペースで Drive 同期を有効にすると（コンソール → ファイルページ →
Drive タブ、または `PUT /api/v1/drive-sync/config` + `POST /roots`。
`google_workspace` の SaaS 連携が前提）、インスタンスが**プロジェクション
テーブル `drive_files`** を最新のファイル一覧（パス、名前、MIME タイプ、
サイズ、更新日時、`drive_id`）に保ち続けます。つまりファイル探索はただの
SQL です — あなたの側に Drive API も OAuth も不要です（他のテーブルと
同様、`drive_files` への SELECT 許可ポリシーは必要です）:

```sql
-- "ls -R" 相当
SELECT path, mime_type, size FROM drive_files ORDER BY path LIMIT 100;

-- "ls | grep" のようなファイル検索
SELECT drive_id, path FROM drive_files WHERE path ILIKE '%2026-06%領収書%';
```

ファイルの*中身*の読み取りはオンデマンドで、サーバー側にキャッシュ
されます:

```bash
# MCP: d6e_read_drive_file { "drive_id": "..." }
curl -s -X POST ${D6E_BASE_URL}/api/v1/drive-sync/read \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{\"workspace_id\":\"${WORKSPACE_ID}\",\"drive_id\":\"<drive_files の drive_id>\"}"
# -> { "storage_file_id": "...", ... }  → storage-file API でダウンロード / テキスト抽出
```

変更されていない Drive ファイルの再読み込みはキャッシュにヒットします。
テキスト抽出（`d6e_extract_file_text`）や画像表示（`d6e_view_image`）は
返ってきた storage file ID を受け付けます。

このセクションの操作は REST と同様にすべて MCP でも実行できます。
探索は `drive_files` への `d6e_sql`、読み取りは `d6e_read_drive_file`、
同期ルート*外*のファイル取得は `d6e_download_external_file` /
`d6e_call_external_api` です。唯一の例外は冒頭の Drive 同期の**初期設定**
（`drive-sync/config` / `roots`）で、対応する MCP ツールはありません —
SaaS 認証情報の接続と同じく、コンソール（または REST）で一度だけ行う
運用者側のステップです。

---

## 5. SaaS API（freee、Google Workspace など）— トークンを持たずに

SaaS の認証情報（freee、Google Workspace、Chatwork、Notion、GitHub、
Salesforce、Box、マネーフォワード、Zendesk への OAuth 接続）は、
ワークスペースメンバーが **d6e コンソールで一度だけ**設定し、サーバー側に
暗号化して保存されます。ローカルエージェントがトークンを見ることは
ありません — プロキシを呼ぶと、インスタンスが認証を注入しリフレッシュも
処理します:

```bash
# freee: 事業所一覧（MCP: d6e_call_external_api）
curl -s -X POST ${D6E_BASE_URL}/api/v1/saas-proxy \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"workspace_id\": \"${WORKSPACE_ID}\",
    \"provider\": \"freee\",
    \"method\": \"GET\",
    \"path\": \"/api/1/companies\"
  }"

# freee: 振替伝票の作成（body 付き POST）
curl -s -X POST ${D6E_BASE_URL}/api/v1/saas-proxy \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"workspace_id\": \"${WORKSPACE_ID}\",
    \"provider\": \"freee\",
    \"method\": \"POST\",
    \"path\": \"/api/1/manual_journals\",
    \"body\": { \"company_id\": 123, \"...\": \"...\" }
  }"
```

補足:

- `path` はプロバイダの API ベースからの相対パスです
  （freee → `https://api.freee.co.jp`、google_workspace →
  `https://www.googleapis.com` など）。
- リクエスト内の `Authorization` / cookie ヘッダは無視されます —
  プロキシが保存済み認証情報から設定します。
- バイナリのアップロード: `file_id`（ワークスペースストレージのファイル
  UUID）を渡します — 単独なら生バイナリ body、`body` と併用すると
  multipart/related（例: メタデータ付き Google Drive アップロード）に
  なります。
- バイナリのダウンロード: 同じ形のリクエストを
  `POST /api/v1/saas-proxy-download` に送ると、レスポンスがワークスペース
  ストレージに保存されます。
- 認証情報エラーで失敗する場合は、まずコンソールでプロバイダを接続 /
  再接続してください（コンソール → 管理 → SaaS連携）。UI で行う必要が
  あるのはこのステップだけです。

---

## 6. QuickJS STF — ローカルでエミュレートせず、リモートで実行する

`runtime: js` の STF はインスタンス内の組み込み **QuickJS** ランタイムで
実行されます。Node ではありません。ローカルでのエミュレートは可能ですが
微妙にズレます。代わりに **instant-run** を使ってください — 何も保存せず、
本物のランタイム・本物のワークスペースデータでコードを実行できます:

```bash
# my-stf.js — モジュールではなくスクリプト形式で書く:
#   const { date_from } = $input;            // $input グローバル = 下の "input" フィールド
#   const rows = sql("SELECT count(*) AS n FROM expenses WHERE date >= '" + date_from + "'");
#   return { count: rows[0].n };              // トップレベル return = ステップ出力
# (`export` / `module.exports` は失敗します — ランタイムはファイルを async IIFE で包みます)

CODE_B64=$(base64 -w0 my-stf.js)
curl -s -X POST ${D6E_BASE_URL}/api/v1/stfs/instant-run \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "X-Workspace-ID: ${WORKSPACE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"runtime\": \"js\",
    \"code\": \"${CODE_B64}\",
    \"input\": { \"date_from\": \"2026-06-01\" },
    \"sources\": {}
  }"
# -> { "success": true, "output": ... }
```

（コードスタイルの完全なルールは
[d6e-plugin-development スキル](../skills/d6e-plugin-development/SKILL.md)
の「JS STF Code Style」を参照。）

MCP では `d6e_instant_run_stf` が相当します（保存済み STF を再実行する
`stf_id` / `stf_version_id` も受け付けます）。

編集・実行ループは、ローカルで `my-stf.js` を編集 → instant-run →
出力/エラーを読む → 繰り返し、です。動くようになったら `d6e_create_stf`
/ `POST /api/v1/stfs` で保存するか、`template.yaml` に載せて配布します。

ランタイム環境（Node との違いとして覚えておくべき点）:

- **ネットワークなし**: `fetch` は存在しません。外部呼び出しは JS STF の
  中ではなく、ワークフローでオーケストレーションされる effect / SaaS
  プロキシの持ち場です。
- **`sql(query)` グローバル**: ワークスペース DB への同期 SQL。SELECT は
  行の配列を直接返し（`const rows = sql("SELECT …")`）、
  INSERT/UPDATE/DELETE は影響行数を返します。エラー時は throw します。
- **`$sources` グローバル**: 上流のワークフローステップの出力（ステップ名
  がキー。instant-run では `sources` フィールドとして渡したもの）。
- **ライブラリ**: バンドル済みのもののみ。`@d6e-ai/<name>` として import
  します — `crypto-js`、`docx`、`fontkit`、`pdf-lib`、`pptxgenjs`、
  `xlsx`、および同梱の日本語フォント（例: `@d6e-ai/mplus-1p-regular`）。
  `npm install` はここには存在しません。（`d6e_list_stf_libraries` で
  現物の一覧を確認できます。）
- `TextEncoder`/`TextDecoder`/`atob`/`btoa` などの標準グローバルは
  polyfill 済み。`process`、`fs`、`require` はありません。

---

## 7. Docker STF — 唯一ローカルで実行するもの

Docker STF は、stdin から JSON オブジェクトを 1 つ読み、stdout に JSON
オブジェクトを 1 つ書くだけの普通のコンテナイメージです。そのため
**ローカルの `docker run` ループは本番の忠実な再現**になります:

```bash
docker build -t my-stf:dev .

echo '{
  "workspace_id": "'"${WORKSPACE_ID}"'",
  "stf_id": "00000000-0000-0000-0000-000000000000",
  "caller": null,
  "api_url": "'"${D6E_BASE_URL}"'",
  "api_token": "'"${D6E_API_KEY}"'",
  "input": { "operation": "check", "period": "2026-06" },
  "sources": {}
}' | docker run -i --rm my-stf:dev
```

- 純粋なロジックのテストでは、`api_url` をモックに向けるかコンテナを
  オフラインのままにします。
- **統合テストでは `api_url`/`api_token` を実インスタンスに向けます** —
  コンテナはインスタンスに起動されたときと全く同じように
  `POST /api/v1/workspaces/{id}/sql` などを呼べます。
- ポリシーの注意点が 1 つ: 本番ではインスタンスが短命のコンテナトークンを
  注入し、SQL ポリシーは **STF** を主体として評価されます。あなたの API
  キーでは**あなた（ユーザー）**として評価されます。ワークスペースの
  ポリシーグループにユーザーと（登録後は）STF の両方を入れておけば、
  両者の挙動は一致します。
- `{"operation": "describe"}` の規約を実装して、`d6e_describe_stf` が
  入力スキーマを報告できるようにしてください。
- ワークフローに組み込む前に、インスタンスが pull できるレジストリへ
  マルチアーキテクチャ（amd64 + arm64）イメージを publish してください。
  開発・テスト・公開の完全なガイドは
  [d6e-docker-stf-skills](https://github.com/d6e-ai/d6e-docker-stf-skills)
  リポジトリを参照してください。

---

## 8. ワークフロー

ワークフロー（入力 → STF ステップ → effect ステップ）は常にインスタンス
上で実行されます。ローカルエージェントからは:

```bash
# リクエスト body がそのままワークフロー入力になります（ラッパーなし）
curl -s -X POST ${D6E_BASE_URL}/api/v1/workflows/${WORKFLOW_ID}/execute \
  -H "Authorization: Bearer ${D6E_API_KEY}" \
  -H "X-Workspace-ID: ${WORKSPACE_ID}" \
  -H 'Content-Type: application/json' \
  -d '{ "period": "2026-06" }'
```

MCP: `d6e_execute_workflow`。実験中の作成・更新は `d6e_create_workflow` /
`d6e_update_workflow` で行い、最終的な定義は `template.yaml` の
`workflows:` セクションに載せます。

---

## 9. d6e チャットエージェントとの挙動差

「ローカルエージェント + インスタンス MCP」は「d6e チャットエージェント」
にどこまで近いのか？

**同一のもの:**

- ツール面: どちらも同じ MCP サーバーと会話し、同じツールが同じ REST
  エンドポイントを同じポリシーチェック・監査ログ付きで呼びます。
- データ: 同じワークスペース DB、同じ Drive ミラー、同じ SaaS 認証情報、
  同じ STF ランタイム。

**異なるもの（設計上の違いで、通常は無視できます）:**

- **システムプロンプト。** d6e エージェントのコンテキストはワークスペース
  から組み立てられます: インストール済みプラグインの `template_prompt`
  （`## PLUGIN: namespace/name@version` セクションとして）、ワークスペース
  のプロンプトルール、プロダクトの指示。ローカルエージェント側には
  代わりにベンダーのプロンプトとあなたのローカルルールが入ります。
- **モデル。** d6e チャットはワークスペースで設定されたモデルを、
  ローカルエージェントは自身のサブスクリプションのモデルを使います。

ローカルの実験をデプロイ後のプラグインに近づけるには、作成中の
`template_prompt` をエージェントのプロジェクトルール（`AGENTS.md` /
`CLAUDE.md` / `.cursor/rules/`）に貼り付けながら反復してください。残る
差分はベンダープロンプトの味付けだけで、ツールの挙動には影響しません —
言い回しと計画スタイルが変わる程度です。

**推奨ワークフロー: `template_prompt` とリソースを一緒に育てる。**
エージェントがツールを誤用したりテーブルを読み違えたりしたら、プロンプト
テキストをローカルで直し、再テストし、それから `template.yaml` に
焼き込みます。

---

## 10. 実験から Plugin 公開まで

ローカルエージェントから各部品が動くようになったら、公開までの手順は
次の通りです。

### 10-a. パッケージ化してインストール

1. リソースを `template.yaml` にまとめます
   （[d6e-plugin-development スキル](../skills/d6e-plugin-development/SKILL.md)
   と [template-yaml-spec.md](./template-yaml-spec.md) を参照）:
   `template_prompt`、`stfs`（インライン JS または Docker イメージ参照）、
   `files`、`effects`、`workflows`。
2. リポジトリを push します — **GitHub でも GitLab でも構いません**
   （`template.yaml` をルートに置く）。Install from URL は web URL を
   raw/API URL に自動変換するので、リポジトリの URL を貼るだけで十分
   です。**プライベートリポジトリ**の場合は、インストール時に読み取り
   権限のあるパーソナルアクセストークン（PAT）の入力も求められます。
3. テスト用ワークスペースにインストール: コンソール → プラグイン →
   **URLからインストール** — 開発時・チーム内プラグインの推奨経路です。
   push のたびに再実行すると、リソースがその場で更新されます。
4. d6e チャット UI で確認します（本物のシステムプロンプト組み立てを
   通すのはこのステップです）。

### 10-b. カスタムフロントエンドがある場合

プラグインには専用フロントエンド（インスタンスの API を呼ぶ独自の
Web アプリ）を付けられます。認証・セッション・プロキシのパターンは
[d6e-custom-frontend-skills](https://github.com/d6e-ai/d6e-custom-frontend-skills)
を、フロントエンド・インスタンス・中央アカウントサイトの関係の全体像は
[frontend-and-instance.ja.md](https://github.com/d6e-ai/d6e-custom-frontend-skills/blob/main/docs/frontend-and-instance.ja.md)
を参照してください。この場合、公開までに次のステップが追加されます:

5. 稼働中のインスタンスに向けてフロントエンドを実装します。開発中は
   **loopback リダイレクト URI**（`localhost`、`127.0.0.0/8`、`[::1]` —
   任意のポート・任意のパス）での OAuth2 ログインが登録なしで動きます
   （d6e ≥ v0.20.1）。
6. フロントエンドをデプロイしたら、その**本番用**リダイレクト URI
   （例: `https://your-app.example.com/auth/callback`）を**両方**に
   登録します:
   - **[https://www.d6e.ai](https://www.d6e.ai/ja-JP)**（d6e の中央
     アカウントサイト）: フランチャイズのオーナー / 管理者が
     `https://www.d6e.ai/{locale}/account/franchise` でセルフサービス
     登録（クライアントのリダイレクト URI リスト）;
   - **d6e インスタンス**: インスタンスの `.env` の
     `ALLOWED_REDIRECT_URIS` に URI を追加。
7. `.env` の変更を反映するため、**d6e インスタンスを再デプロイ / 再起動**
   します（インスタンスホストで `docker compose up -d` など）。
   インスタンス自体に触る唯一のステップなので、インスタンス運用者と
   調整してください。

### 10-c. マーケットプレイス掲載（任意）

8. [d6e-plugin-registry](https://github.com/d6e-ai/d6e-plugin-registry)
   へのプルリクエストでマーケットプレイスに公開します。

### チェックリスト

- [ ] API キーをコンソールで作成して保存した（`d6e_…`）
- [ ] ローカルエージェントを `http://<instance-host>:8081/mcp` に接続した（または curl で REST）
- [ ] SQL / Drive / SaaS 呼び出しをローカルエージェントから確認した
- [ ] JS STF を instant-run で検証した（ローカル Node の代用ではなく）
- [ ] Docker STF をローカル `docker run` で検証し、次に `api_url` をインスタンスに向けて検証した
- [ ] 反復中は `template_prompt` の下書きをローカルエージェントのルールに写した
- [ ] `template.yaml` を URL からインストールし（プライベートリポジトリなら PAT を入力）、d6e チャットで再確認した
- [ ] （カスタムフロントエンドの場合）本番リダイレクト URI を www.d6e.ai **と**インスタンスの `ALLOWED_REDIRECT_URIS` の両方に登録し、インスタンスを再起動した

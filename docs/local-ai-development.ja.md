# ローカル AI ハーネスで d6e Plugin を開発する

English version: [local-ai-development.md](./local-ai-development.md)

このガイドは、**ローカルの AI コーディングハーネス**（Codex CLI、Claude
Code、Cursor など、シェルコマンドの実行や MCP サーバーへの接続ができる
エージェント）から**稼働中の d6e インスタンス**に接続して d6e Plugin を
開発・テストする方法を説明します。最後の仕上げまで、d6e へのデプロイは
一切不要です。

これを可能にしている核心は、**d6e の AI エージェントができることはすべて
インスタンスの公開 HTTP API として提供されている**という事実です。d6e 内
のチャットエージェントは、あなたのラップトップから呼べるのと同じ MCP
サーバー・同じ REST API と会話しています。「d6e の中でしか使えない機能」
は存在しません。

```
┌────────────────────┐        ┌────────────────────────────────────┐
│ ローカル AI ハーネス │        │ d6e インスタンス (https://…)       │
│ (Codex / Claude     │  MCP   │  ┌──────────┐   ┌──────────────┐  │
│  Code / Cursor)     │───────▶│  │ MCP :8081│──▶│ Rust API      │  │
│                     │  REST  │  └──────────┘   │  /api/v1/*    │  │
│  Docker STF 開発は  │───────▶│                 │  SQL / STF /  │  │
│  ローカル Docker    │        │                 │  Drive / SaaS │  │
└────────────────────┘        │                 └──────┬───────┘  │
                               │            PostgreSQL ◀┘          │
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
| テンプレートプロンプトの挙動 | ローカルハーネス ≈ d6e チャット | [d6e チャットエージェントとの挙動差](#9-d6e-チャットエージェントとの挙動差)参照 |

本文中のプレースホルダ:

- `D6E_BASE_URL` — 対象インスタンス。例: `https://cauchye.d6e.ai`
- `D6E_AUTH_URL` — 中央認証サーバー。`https://www.d6e.ai`
- `WORKSPACE_ID` — ワークスペース設定ページ（`${D6E_BASE_URL}/{locale}/workspaces/{id}/settings`）で確認できる UUID

---

## 1. 認証情報の取得（初回のみ、約 2 分）

すべての `/api/v1/*` エンドポイントは `Authorization: Bearer <token>` を
受け付けます。トークンは **短命の JWT**（OAuth2 ログインで取得）か
**長命の API キー**（`d6e_…`）のどちらかです。ハーネスでの作業には API
キーを使います。JWT は API キーを作成する最初の一回だけ必要です。

### 1-a. OAuth2 で JWT を取得（loopback リダイレクト）

loopback リダイレクト URI — `localhost`、`127.0.0.0/8`、`[::1]` の
**任意のポート・任意のパス** — は d6e-auth とインスタンスのトークン
リレーの両方で常に許可されます（d6e ≥ v0.20.1）。allow-list への登録は
不要です。

1. インスタンスの OAuth クライアント ID（`d6e_…` — API キーとは別物）を
   取得します。ワークスペース設定ページ
   （`/{locale}/workspaces/{id}/settings`、ワークスペース admin ロールが
   必要）の **連携情報** セクションに表示されています。見られない場合は
   インスタンス運用者に確認してください（インスタンスの `.env` の
   `D6E_AUTH_CLIENT_ID`）。

2. ブラウザで次の URL を開きます（手動実行なら `state` は任意の値で
   構いません）:

   ```
   ${D6E_AUTH_URL}/auth/login?client_id=${CLIENT_ID}&redirect_uri=http://localhost:8976/cb&state=manual&response_type=code
   ```

3. リダイレクトを受け取ります。最も簡単なのは、ログイン前に使い捨ての
   リスナーを立てておくことです:

   ```bash
   python3 -c "
   from http.server import BaseHTTPRequestHandler, HTTPServer
   class H(BaseHTTPRequestHandler):
       def do_GET(self):
           print(self.path)  # /cb?code=...&state=manual
           self.send_response(200); self.end_headers()
           self.wfile.write(b'code received - close this tab')
   HTTPServer(('127.0.0.1', 8976), H).handle_request()"
   ```

   （リスナーを立てない場合、ブラウザには接続エラーが表示されますが
   アドレスバーに `code=` が残っているのでそこからコピーできます。）

4. code を**インスタンス側で**交換します（d6e-auth ではありません —
   インスタンスが自身のクライアント認証情報を注入するため、client
   secret は一切不要です）:

   ```bash
   curl -s ${D6E_BASE_URL}/api/v1/auth/token \
     -H 'Content-Type: application/json' \
     -d '{"grant_type":"authorization_code","code":"<CODE>","redirect_uri":"http://localhost:8976/cb"}'
   # -> { "access_token": "...", "refresh_token": "...", ... }
   ```

### 1-b. 長命の API キーを発行

d6e > v0.21.0 のインスタンスでは下記の curl は不要です。コンソールを
開き、ヘッダーのアバター →「**APIキー**」（`/{locale}/user/api-keys`）
から UI で作成できます（この場合 1-a の手順も不要です — コンソールへの
ログイン自体が OAuth2 フローだからです）。旧バージョンでは API で発行
します:

```bash
curl -s -X POST ${D6E_BASE_URL}/api/v1/api-keys \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"codex-local-dev"}'
# -> { "key": "d6e_0198...", ... }   ← 表示は一度きり。必ず保存
```

`expires_at`（ISO 8601）は省略可能で、省略すると無期限のキーになります。
キーはあなたのユーザー ID とワークスペースメンバーシップを引き継ぎます。
以降はすべて `Authorization: Bearer d6e_…` を使い、ワークスペース
スコープのエンドポイントには `X-Workspace-ID: ${WORKSPACE_ID}` ヘッダを
付けます。

動作確認:

```bash
curl -s ${D6E_BASE_URL}/api/v1/workspaces -H "Authorization: Bearer ${D6E_API_KEY}"
```

---

## 2. ハーネスをインスタンスの MCP サーバーに接続する（推奨）

インスタンスは d6e MCP サーバーを HTTP モードで実行しています
（デフォルトポート **8081**、パス `/mcp`）。これは *d6e チャット
エージェントが使っているのと同じサーバー・同じ約 90 個の `d6e_*`
ツール*です。ハーネスをここに接続すれば、ホストされたエージェントと
ツール単位で完全に同等になります: `d6e_sql`、`d6e_list_files`、
`d6e_search_files`、`d6e_read_drive_file`、`d6e_call_external_api`、
`d6e_instant_run_stf`、`d6e_execute_workflow`、`d6e_create_stf` など。

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
載せています — ハーネスからの `curl` でも全く同じことができます。

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

---

## 5. SaaS API（freee、Google Workspace など）— トークンを持たずに

SaaS の認証情報（freee、Google Workspace、Chatwork、Notion、GitHub、
Salesforce、Box、マネーフォワード、Zendesk への OAuth 接続）は、
ワークスペースメンバーが **d6e コンソールで一度だけ**設定し、サーバー側に
暗号化して保存されます。ハーネスがトークンを見ることはありません —
プロキシを呼ぶと、インスタンスが認証を注入しリフレッシュも処理します:

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

編集・実行ループは、ハーネスでローカルに `my-stf.js` を編集 →
instant-run → 出力/エラーを読む → 繰り返し、です。動くようになったら
`d6e_create_stf` / `POST /api/v1/stfs` で保存するか、`template.yaml` に
載せて配布します。

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
  [d6e-docker-stf-skills](https://gitlab.com/cauchye/d6e-ai/d6e-docker-stf-skills)
  リポジトリを参照してください。

---

## 8. ワークフロー

ワークフロー（入力 → STF ステップ → effect ステップ）は常にインスタンス
上で実行されます。ハーネスからは:

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

「自分のハーネス + インスタンス MCP」は「d6e チャットエージェント」に
どこまで近いのか？

**同一のもの:**

- ツール面: どちらも同じ MCP サーバーと会話し、同じツールが同じ REST
  エンドポイントを同じポリシーチェック・監査ログ付きで呼びます。
- データ: 同じワークスペース DB、同じ Drive ミラー、同じ SaaS 認証情報、
  同じ STF ランタイム。

**異なるもの（設計上の違いで、通常は無視できます）:**

- **システムプロンプト。** d6e エージェントのコンテキストはワークスペース
  から組み立てられます: インストール済みプラグインの `template_prompt`
  （`## PLUGIN: namespace/name@version` セクションとして）、ワークスペース
  のプロンプトルール、プロダクトの指示。ハーネス側には代わりにベンダーの
  プロンプトとあなたのローカルルールが入ります。
- **モデル。** d6e チャットはワークスペースで設定されたモデルを、
  ハーネスは自身のサブスクリプションのモデルを使います。

ローカルの実験をデプロイ後のプラグインに近づけるには、作成中の
`template_prompt` をハーネスのプロジェクトルール（`AGENTS.md` /
`CLAUDE.md` / `.cursor/rules/`）に貼り付けながら反復してください。残る
差分はベンダープロンプトの味付けだけで、ツールの挙動には影響しません —
言い回しと計画スタイルが変わる程度です。

**推奨ワークフロー: `template_prompt` とリソースを一緒に育てる。**
エージェントがツールを誤用したりテーブルを読み違えたりしたら、プロンプト
テキストをローカルで直し、再テストし、それから `template.yaml` に
焼き込みます。

---

## 10. 実験から Plugin へ

ハーネスから各部品が動くようになったら:

1. リソースを `template.yaml` にまとめます
   （[d6e-plugin-development スキル](../skills/d6e-plugin-development/SKILL.md)
   と [template-yaml-spec.md](./template-yaml-spec.md) を参照）:
   `template_prompt`、`stfs`（インライン JS または Docker イメージ参照）、
   `files`、`effects`、`workflows`。
2. インスタンスから到達できる raw URL でホストします（プラグイン
   リポジトリの GitLab raw URL）。
3. テスト用ワークスペースにインストール: コンソール → プラグイン →
   **URLからインストール** — 開発時・チーム内プラグインの推奨経路です。
4. d6e チャット UI で確認します（本物のシステムプロンプト組み立てを
   通すのはこのステップです）。
5. 必要なら
   [d6e-plugin-registry](https://gitlab.com/cauchye/d6e-ai/d6e-plugin-registry)
   へのマージリクエストでマーケットプレイスに公開します。

### チェックリスト

- [ ] API キーを作成して保存した（`d6e_…`）
- [ ] ハーネスを `http://<instance-host>:8081/mcp` に接続した（または curl で REST）
- [ ] SQL / Drive / SaaS 呼び出しをハーネスから確認した
- [ ] JS STF を instant-run で検証した（ローカル Node の代用ではなく）
- [ ] Docker STF をローカル `docker run` で検証し、次に `api_url` をインスタンスに向けて検証した
- [ ] 反復中は `template_prompt` の下書きをローカルハーネスのルールに写した
- [ ] `template.yaml` を URL からインストールして d6e チャットで再確認した

# Context7 MCP（Tauri v2 ドキュメント固定）

Swallow のデスクトップ実装で **Tauri v2 公式ドキュメント** をエージェントに引かせるための MCP 設定。パッケージは MIT（`@upstash/context7-mcp`）。

## 版固定（一次情報）

| 項目           | 値                                                                       |
| -------------- | ------------------------------------------------------------------------ |
| npm パッケージ | `@upstash/context7-mcp`                                                  |
| 固定版         | **4.7.0**（`npm view @upstash/context7-mcp version`、確認日 2026-11-12） |
| ライセンス     | MIT（`npm view @upstash/context7-mcp license`）                          |
| 設定の雛形     | [`.cursor/mcp.json.example`](../.cursor/mcp.json.example)                |

`@latest` は使わず、上記版を PR で明示的に上げる。

## 認証（リポに書かない）

- 変数名: **`CONTEXT7_API_KEY`**（`@upstash/context7-mcp@4.7.0` の CLI ヘルプ・`process.env.CONTEXT7_API_KEY`）
- 発行: [context7.com/dashboard](https://context7.com/dashboard?tab=settings)（任意だがレート制限緩和）
- **`.env` / Cursor Runtime Secret にだけ置く。** リポ・`mcp.json`（コミット版）・PR 本文に実キーを載せない
- `mcp.json.example` の `CONTEXT7_API_KEY` は空文字。実運用では Cursor MCP 設定またはホストの `.env` で注入する（コミット版 `mcp.json` を作る場合も値を入れない）

### Cursor Cloud Agent

1. Cursor Dashboard → このリポ（または Project）の **Runtime Secrets** に `CONTEXT7_API_KEY` を追加
2. 手元の MCP 設定は Dashboard の MCP 画面で同サーバーを登録するか、VM 起動後にシェルが継承するシークレット経由で `npx @upstash/context7-mcp@4.7.0` がキーを読む
3. シークレット無しでも動作はするがレート制限が厳しい（上流 README）。Tauri 実装タスクではキー設定を推奨

### ローカル・Orca

`.env.example` を `.env` にコピーし `CONTEXT7_API_KEY=` を埋める（コミットしない）。`~/.cursor/mcp.json` またはプロジェクトの `.cursor/mcp.json` に example と同型の定義を入れ、`env` でホストの変数を渡す。

## Tauri v2 ライブラリ ID（Context7）

ID は `https://context7.com/api/v2/libs/search?query=...`（2026-11-12 確認）で突き合わせる。推測で ID を増やさない。

| 用途                      | Library ID                      | 根拠                                                                           |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| **v2 公式ガイド（既定）** | `/tauri-apps/tauri-docs`        | 検索 `tauri` で `tauri-apps` 組織、`branch`: `v2`。CLI・JS API・プラグイン文書 |
| 公式プラグイン一覧        | `/tauri-apps/plugins-workspace` | 同上。`branch`: `v2`                                                           |
| Rust クレート API（補助） | `/websites/rs_tauri`            | 検索ヒット。プロンプトで **crate 版**（例: `2.9.x`）を指定                     |
| **使わない**              | `/websites/v2_tauri_app`        | `GET .../libs/websites/v2_tauri_app` → **Not Found**（未確認扱いで採用しない） |
| **使わない（v1）**        | `/websites/tauri_app`           | 検索結果の `versions`: `v1`                                                    |

プロンプト例:

```txt
Tauri 2 のプラグイン権限モデルを確認して実装する。use library /tauri-apps/tauri-docs
```

## 使う場面 / 使わない場面

| 使う                                                                                         | 使わない                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/desktop/src-tauri/` の Tauri 2 設定・`#[tauri::command]`・プラグイン・権限・ウィンドウ | 公式ドキュメントに無い Swallow 独自の境界判断（`AGENTS.md` のみで足りる） |
| `features/*/api.ts` の `invoke` / イベント名と v2 JS API の整合                              | Chrome 拡張（別 Project）                                                 |
| `tauri.conf.json` / capability まわり                                                        | テーマ・スタイルトークン                                                  |

## 関連

- 独立レビュー: `.agents/skills/code-review/SKILL.md`
- セキュリティ差分: `.agents/skills/differential-review/SKILL.md`（マージ済みなら利用）

---

name: new-feature
description: >-
Swallow に新しい desktop feature（features/<name>/）を追加するときのスキャフォールドと
レイヤー横断チェックリスト。境界 CI・Tauri 契約・HTTP 契約に違反しない手順。
---

# 新機能（feature）追加

製品機能そのものではなく、**境界と契約を守った feature ディレクトリ**を用意する。
実装はスキャフォールド後に行う。

## 1. スキャフォールド

```sh
scripts/agent/new-feature.sh <feature-name> [--with-api] [--with-sidebar] [--dry-run]
```

- `<feature-name>` は kebab-case（例: `bookmarks`, `smart-views`）
- 予約名 `app` / `shared` / `platform` は不可
- 既存の `apps/desktop/src/features/<name>` があると拒否する

| オプション       | 内容                                                         |
| ---------------- | ------------------------------------------------------------ |
| `--with-api`     | `api.ts` を生成（**invoke は書かない** — Rust 登録後に追加） |
| `--with-sidebar` | `sidebar/<Pascal>Section.tsx` と `index.ts` からの export    |
| `--dry-run`      | 書き込みなしでパスとチェックリストのみ表示                   |

スクリプト末尾のチェックリストをそのまま作業チケットに使う。

## 2. 共有型（`@swallow/shared`）

1. `packages/shared/src/<domain>/` に型・純関数を置く
2. `packages/shared/src/index.ts` から re-export
3. フロントと Rust の serde 名は `camelCase` で揃える

## 3. Rust バックエンド

| 層                   | 役割                                                            |
| -------------------- | --------------------------------------------------------------- |
| `domain/`            | ビジネスロジック（`commands` / `infra` / `tauri` に依存しない） |
| `commands/<領域>.rs` | `#[tauri::command]` 実装                                        |
| `commands/mod.rs`    | `swallow_invoke_handler!` にコマンド名を登録                    |
| `infra/`             | HTTP・サムネイルなど外部 I/O                                    |

`pnpm test` の `rust-module-boundaries.mjs` がレイヤー違反を検出する。

## 4. フロント feature

- **公開面**: `features/<name>/index.ts`（hooks・components・sidebar を re-export）
- **Tauri IPC**: `features/<name>/api.ts` のみで `invoke` / `listen`
- feature 間は `features/<other>` または `features/<other>/api` のみ import（内部 `lib/` 直 import 禁止）

Rust コマンドを追加したら `api.ts` に型付きラッパを書く。未登録の `invoke("...")` は `tauri-command-contract.mjs` で落ちる。

## 5. アプリ配線（必要なときだけ）

### サイドバー

`apps/desktop/src/app/sidebarRegistry.tsx` の `sidebarSections` にエントリを追加:

- `id`: 通常は feature 名と同じ kebab-case
- `Component`: `index.ts` から export した Section
- `requiredProviders`: `APP_FEATURE_PROVIDERS` の id と一致させる

不変条件は `assertValidSidebarRegistry` と関連 Vitest で検証済み。

### Session / Provider

ライブラリ状態を React Context で配る場合:

1. feature 内に `*Provider` と hook を実装
2. `apps/desktop/src/app/appFeatureProviders.tsx` の `APP_FEATURE_PROVIDERS` に spec を追加
3. `useAppSession` などから `selectValue` で session スライスを渡す

## 6. ローカル HTTP API（Chrome 拡張と共有する場合）

1. `packages/shared/src/api/httpContract.ts` の `HTTP_API_ROUTES` にルート定義
2. `apps/desktop/src-tauri/src/infra/http_api.rs` の `HTTP_API_ROUTE_SPECS` を同期
3. `pnpm test` の `http-api-contract.mjs` が三者整合を検証

## 7. 検証（PR 前）

```sh
pnpm lint && pnpm typecheck && pnpm test
scripts/agent/check.sh   # PR 直前（pnpm ci:all 相当）
```

`pnpm test` には `new-feature-scaffold.test.sh` があり、スキャフォールド出力が境界・契約 CI と Biome を通すことを保証する。

## 関連

- モジュール境界: `AGENTS.md` の「モジュール境界」
- Issue 駆動 PR: `.agents/skills/issue-to-pr/SKILL.md`

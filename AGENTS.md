# AGENTS.md

Eagle 代替の素材管理アプリ。Tauri 2（Rust）+ React + TypeScript のデスクトップアプリと Chrome 拡張の pnpm モノレポ。

## 長期の予定・進捗

正本は GitHub（Milestone / Label）。入口は [`docs/HANDOFF.md`](docs/HANDOFF.md)。

```sh
gh issue list --milestone beta --label P1 --state open   # 次に着手する作業
```

## Issue から PR まで

Issue を 1 件担当するときは `.agents/skills/issue-to-pr/SKILL.md` を読み、その手順に従って PR 作成まで人に確認せず進める（スキルとして読み込まれていなくても同じ）。

```sh
scripts/agent/start-issue.sh <N> [--worktree]   # 重複確認、ブランチ準備、Issue の表示（worktree の置き場所は $SWALLOW_WORKTREE_DIR）
scripts/agent/new-feature.sh <name>             # 新 feature の境界安全なスキャフォールド（手順は .agents/skills/new-feature/SKILL.md）
scripts/agent/review-staged.sh                  # commit 前: staged のセルフレビュー補助 + 軽い機械チェック
scripts/agent/check.sh                          # CI と同じ pnpm ci:all。通ると PR 作成が許可される
scripts/agent/check-rust.sh                     # Rust のみ（反復用）。PR 直前は check.sh
scripts/agent/open-pr.sh --title "<title>" --body-file <path>
```

`pnpm install`（`prepare`）で `.githooks` を有効化する。未設定なら `scripts/agent/install-hooks.sh`。pre-commit は Biome（`--staged`）と staged `.rs` の rustfmt のみ。フル `ci:all` は載せない（`check.sh` 側）。`--no-verify` は使わない。

`pnpm ci:all` と `pnpm dev` は **cargo が PATH にあること**が前提。Rust 未導入のホストや Cloud Agent では Dev Container、`docker compose run --rm build`、または `.cursor/environment.json` の Docker ビルドイメージ（推奨）を使う。イメージ無し起動時は `scripts/agent/environment-install.sh` が rustup で toolchain を入れる（Linux で GUI を動かす場合は Tauri のシステム依存も必要。README 参照）。

Orca で作った worktree では手元で実装せず、`scripts/agent/cloud-run.sh <N>` で Cloud Agent に依頼する。`.cursor/cli.json` で書き込みやビルドが禁止されているのはそのため。

## バグの扱い

不具合対応は **先に GitHub Issue を作り、記録を残してから** 修正 PR に進む（口頭やチャットだけで直さない）。

1. 既存 Issue を検索し、無ければ `gh issue create` で新規作成する（ラベル `bug`、領域 `area:*`、優先度 `P1`/`P2`/`P3`、Milestone を付ける）
2. 本文に再現手順・受け入れ条件・原因仮説（分かれば）を書く。チャットでの調査結果もここに要約する
3. その後 `scripts/agent/start-issue.sh <N>` から通常どおり PR まで進める（PR は `Closes #<N>`）
4. ユーザーが「Issue にして」とだけ言った場合は Issue 作成で止め、修正は依頼があるまで着手しない

## 構成

| パス                         | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src`           | React フロントエンド（機能ベース）。`app/`（`main.tsx`・`bootstrap.ts`・`App.tsx`・`AppProviders.tsx`・`AppLayout.tsx`・`useAppSession.ts`・`sidebarRegistry.tsx`）、`features/<domain>/`（公開面 `api.ts`・`index.ts`、実装は各 feature 内の `hooks/`・`components/`・`lib/`）、`platform/`（`dialog.ts`・`disableDefaultContextMenu.ts` 等。**移行用** `platform/tauri/index.ts` バレルは廃止方向で、新規は `features/<domain>/api.ts` を使う）、`shared/`（`context-menu/` と `format.ts`・`focusInspector.ts`・`useLatest.ts` など横断ユーティ）。**Tauri の `invoke` / `listen` は各 `features/*/api.ts` に限定** |
| `apps/desktop/src-tauri/src` | Rust バックエンド。`lib.rs` はファサードで `app/`（`run.rs`・`state.rs`）、`commands/`（機能別 `.rs` + `mod.rs` の `swallow_invoke_handler!` で登録）、`domain/`（`item/` サブツリーと `library.rs`・`settings.rs`・`tags.rs`・`folders.rs`・`smart_folders.rs`・`color_label.rs` など）、`infra/`（`http_api`・`protocol`・`thumbnail`）へ委譲                                                                                                                                                                                                                                                                        |
| `packages/shared/src`        | デスクトップと拡張で共有する型と純粋関数（`@swallow/shared`）。`api/`・`library/`・`settings/`・`folders/`・`tags/`・`smart-folders/`・`items/`・`import/`・`color-label/` などドメイン別フォルダを `index.ts` で再エクスポート                                                                                                                                                                                                                                                                                                                                                                                        |

ライブラリはディレクトリで、アイテムは `images/<id>.info/` に実ファイルと `metadata.json` を置く。タグは `tags.json`。

### モジュール境界（フロント）

- **依存の向き**: `app` → `features` → `shared` / `platform`（単方向）。`shared` と `platform` は `features` や `app` を import しない。`features` は `app` を import しない。
- **feature 間**: `features/<A>` から別 feature の内部（`components/`・`lib/` など実装ディレクトリ）へ直接入らない。利用は相手 feature の公開面（`features/<B>/index.ts`・`api.ts`）または `shared/`・`@swallow/shared` の契約経由。
- **Tauri IPC**: フロントは上記のとおり `features/*/api.ts` のみ。Rust は `commands/<feature>.rs` を `commands/mod.rs` の `swallow_invoke_handler!` に載せる。Rust と `invoke` 名の整合は CI の `scripts/ci/tauri-command-contract.mjs` が検証する（`pnpm test` に含まれる）。
- **境界の CI**: feature 間 import のルールは `scripts/ci/feature-boundaries.mjs` が検証する（`pnpm test` に含まれる。`tauri-command-contract.mjs` と併用）。
- **HTTP API**: Chrome 拡張向けループバック API のルート表は `packages/shared/src/api/httpContract.ts`（`HTTP_API_ROUTES`）が正本。Rust の `infra/http_api.rs` 内 `HTTP_API_ROUTE_SPECS` および拡張の呼び出しとの整合は `scripts/ci/http-api-contract.mjs` が検証する（`pnpm test` に含まれる）。

### モジュール境界（Rust バックエンド）

- **依存の向き**: `commands` → `domain` + `infra`（+ `app::state` で共有状態）。`domain` は `commands` / `infra` / `app` / `tauri` / `axum` に依存しない。`infra` は `domain`（と必要なら `app::state`）+ `tauri` / HTTP 用クレートを使い、`commands` や `app::run` には入らない。
- **lib.rs**: モジュール宣言と `pub use app::run` のファサードのみ（ビジネスロジックや `#[tauri::command]` は載せない）。
- **境界の CI**: レイヤー依存は `scripts/ci/rust-module-boundaries.mjs` が検証する（`pnpm test` に含まれる。`tauri-command-contract.mjs` / `feature-boundaries.mjs` と併用）。Tauri コマンド名とフロント IPC 境界は「モジュール境界（フロント）」の **Tauri IPC** と同じ契約。

## コマンド

| 目的                    | コマンド                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------- |
| 全チェック（CI と同じ） | `pnpm ci:all` / `scripts/agent/check.sh`（PR 直前はこちら）                        |
| JS のみ                 | `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`                        |
| Rust のみ（反復）       | `scripts/agent/check-rust.sh` または `pnpm rust:fmt` → `rust:clippy` → `rust:test` |
| 整形                    | `pnpm format`（Biome）、`cargo fmt --all`                                          |
| コミット前（staged）    | `scripts/agent/review-staged.sh`                                                   |
| フック再インストール    | `scripts/agent/install-hooks.sh`                                                   |
| アプリ起動              | `pnpm dev`                                                                         |

## 規約

- 上記「モジュール境界」に従う。新規 Tauri コマンドは Rust の `commands/<領域>.rs` に実装し `commands/mod.rs` の `swallow_invoke_handler!` に追加し、フロントは対応する `features/<domain>/api.ts` に `invoke` を置く（契約テストを更新しないと CI が落ちる）
- Rust と TS で同じデータを扱う型は `#[serde(rename_all = "camelCase")]` で `packages/shared` の型と一致させる。片方を変えたらもう片方も変える
- 振る舞いを変えたらテストを追加する。Rust は同じファイルの `#[cfg(test)] mod tests`、TS は隣に `*.test.ts`（Vitest）
- ファイル書き込みは一時ファイル経由で行い、書きかけの `metadata.json` を残さない
- Lint・型・Clippy の警告は直して通す。`#[allow]`、`biome-ignore`、`@ts-ignore`、テストの skip で回避しない
- 依存の追加は必要最小限にし、PR 本文に理由を書く
- コメントはコードから読み取れない制約だけを書く
- PR タイトル・本文、Issue コメントは日本語。PR タイトルは Conventional Commits（`feat(desktop): …`）。scope は `desktop` / `shared` / `extension` / `ci` など

## やってはいけないこと

- `main` への直接 push、PR のマージ、他人のブランチへの push
- 自分のブランチ以外への force push。自分のブランチでも `--force-with-lease` のみ
- Issue の本文・ラベルの編集やクローズ（コメントは可）

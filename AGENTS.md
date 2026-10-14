# AGENTS.md

Eagle 代替の素材管理アプリ。Tauri 2（Rust）+ React + TypeScript のデスクトップアプリと Chrome 拡張の pnpm モノレポ。

## Issue から PR まで

Issue を 1 件担当するときは `.agents/skills/issue-to-pr/SKILL.md` の手順に従い、PR 作成まで人に確認せず進める。

```sh
scripts/agent/start-issue.sh <N> [--worktree]   # 重複確認、ブランチ準備、Issue の表示（worktree の置き場所は $SWALLOW_WORKTREE_DIR）
scripts/agent/check.sh                          # CI と同じ pnpm ci:all。通ると PR 作成が許可される
scripts/agent/open-pr.sh --title "<title>" --body-file <path>
```

Orca で Issue を紐付けて worktree を作ると、`orca.yaml` により依存のインストールとこの手順の指示が自動で行われる。

## 構成

| パス | 内容 |
|---|---|
| `apps/desktop/src` | React フロントエンド。Tauri コマンドの呼び出しは `src/lib/commands.ts` に集約 |
| `apps/desktop/src-tauri/src` | Rust バックエンド。コマンドは `commands.rs` に定義し `lib.rs` の `generate_handler!` に登録 |
| `packages/shared/src` | デスクトップと拡張で共有する型と純粋関数（`@swallow/shared`） |

ライブラリはディレクトリで、アイテムは `images/<id>.info/` に実ファイルと `metadata.json` を置く。タグは `tags.json`。

## コマンド

| 目的 | コマンド |
|---|---|
| 全チェック（CI と同じ） | `pnpm ci:all` |
| JS のみ | `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` |
| Rust のみ | `pnpm rust:fmt` / `pnpm rust:clippy` / `pnpm rust:test` |
| 整形 | `pnpm format`（Biome）、`cargo fmt --all` |
| アプリ起動 | `pnpm dev` |

## 規約

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

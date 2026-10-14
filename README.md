# Swallow

Eagle代替の素材管理アプリ。Tauri 2 + React + TypeScript のデスクトップアプリと Chrome 拡張で構成する。

## 構成

| パス | 内容 |
|---|---|
| `apps/desktop` | Tauri 2 アプリ（`src` が React、`src-tauri` が Rust） |
| `packages/shared` | デスクトップアプリと拡張で共有する型 |
| `docker/build.Dockerfile` | CI / compose / devcontainer 共通のビルド環境 |

ツールのバージョンは `rust-toolchain.toml`、`.nvmrc`、`package.json` の `packageManager` で固定している。

## ローカル開発（ホスト）

```sh
corepack enable
pnpm install
pnpm dev        # Tauri アプリを起動
```

Linux でホスト開発する場合は [Tauri の前提パッケージ](https://v2.tauri.app/start/prerequisites/) が必要。

## コンテナでのビルドとテスト

CI と同じ環境でチェックやビルドを実行できる。GUI の起動はホスト側で行う。

```sh
docker compose build
docker compose run --rm build pnpm install --frozen-lockfile
docker compose run --rm build pnpm ci:all        # Lint、型チェック、テスト、ビルド、fmt、clippy、cargo test
docker compose run --rm build pnpm bundle:linux  # deb / rpm / AppImage
```

VS Code / Cursor の Dev Containers でも同じイメージを使える（`.devcontainer/devcontainer.json`）。

## ローカル HTTP API（拡張連携用）

デスクトップアプリは起動中、`127.0.0.1:41600` で拡張向けの API を提供する。パスと型は `packages/shared/src/api.ts`。

| エンドポイント | 内容 |
|---|---|
| `GET /api/app/info` | `AppInfo` を返す |
| `POST /api/items?name=&ext=&url=` | 本文のバイナリを開いているライブラリに取り込み、`201` で `ItemMetadata` を返す。`ext` を省くと `Content-Type` から決める |

エラーは `{ "code", "message" }`（`ApiError`）で返し、ライブラリ未オープンは `503`。接続元が loopback 以外、`Host` が localhost 以外、`Origin` が `chrome-extension://` 以外のリクエストは `403` で拒否する。

## AI エージェントでの開発

規約と Issue から PR までの手順は `AGENTS.md` と `.agents/skills/issue-to-pr/SKILL.md` にある（Cursor と Codex はスキルとして読み込み、Claude Code は `CLAUDE.md` 経由で `AGENTS.md` から参照する）。補助スクリプトは `scripts/agent/`。Orca で Issue から worktree を作ると、`orca.yaml` で依存のインストールとエージェントへの指示が自動で行われる。

## CI

| ワークフロー | 内容 |
|---|---|
| `build-image.yml` | ビルド用イメージを入力ファイルのハッシュをタグにして GHCR へ push（既存なら再利用） |
| `ci.yml` | コンテナで `pnpm ci:all` と deb のビルド、macOS / Windows ランナーでネイティブビルド |
| `release.yml` | `v*` タグで Linux / macOS (arm64, x64) / Windows のインストーラーを下書きリリースに添付 |

Tauri はクロスコンパイルに対応していないため、macOS と Windows はコンテナではなく各 OS のランナーでビルドする。

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

規約と Issue から PR までの手順は `AGENTS.md` と `.agents/skills/issue-to-pr/SKILL.md` にある（Cursor と Codex はスキルとして読み込み、Claude Code は `CLAUDE.md` 経由で `AGENTS.md` から参照する）。補助スクリプトは `scripts/agent/`。

Orca で作った worktree では、実装を Cursor の Cloud Agent に任せる。`orca.yaml` の setup が `scripts/agent/cloud-only.cli.json` を `.cursor/cli.json` に置き、手元の `cursor-agent` のファイル書き込み、ビルド、テスト、コミット、push を禁止する。Issue を紐付けて作ると、エージェントは `scripts/agent/cloud-run.sh` で Cloud Agent に依頼し、その URL を報告する。

- Cloud Agent は `.cursor/environment.json` により CI と同じ `docker/build.Dockerfile` のイメージで動く
- `CURSOR_API_KEY`（Cursor Dashboard の API Keys で発行）を Orca から起動するシェルに設定しておく
- Cloud Agent に `gh` を使わせるなら、このリポジトリに限定した fine-grained token を `SWALLOW_CLOUD_GH_TOKEN` に設定する。未設定でも Cursor が PR を自動で作る
- 禁止は主要なコマンドを列挙したもので、シェル経由の書き込みまでは防げない

## CI

| ワークフロー | 内容 |
|---|---|
| `build-image.yml` | ビルド用イメージを入力ファイルのハッシュをタグにして GHCR へ push（既存なら再利用） |
| `ci.yml` | コンテナで `pnpm ci:all` と deb のビルド、macOS / Windows ランナーでネイティブビルド |
| `release.yml` | `v*` タグで Linux / macOS (arm64, x64) / Windows のインストーラーを下書きリリースに添付 |

Tauri はクロスコンパイルに対応していないため、macOS と Windows はコンテナではなく各 OS のランナーでビルドする。

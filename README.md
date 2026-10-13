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

## CI

| ワークフロー | 内容 |
|---|---|
| `build-image.yml` | ビルド用イメージを入力ファイルのハッシュをタグにして GHCR へ push（既存なら再利用） |
| `ci.yml` | コンテナで `pnpm ci:all` と deb のビルド、macOS / Windows ランナーでネイティブビルド |
| `release.yml` | `v*` タグで Linux / macOS (arm64, x64) / Windows のインストーラーを下書きリリースに添付 |

Tauri はクロスコンパイルに対応していないため、macOS と Windows はコンテナではなく各 OS のランナーでビルドする。

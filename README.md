# Swallow

A material management application. It consists of a Tauri 2 + React + TypeScript desktop app and a Chrome extension.

## Layout

| Path | Description |
|---|---|
| `apps/desktop` | Tauri 2 app (`src` is React, `src-tauri` is Rust) |
| `packages/shared` | Types shared by the desktop app and the extension |
| `docker/build.Dockerfile` | Build environment shared by CI, Compose, and Dev Containers |

Tool versions are pinned in `rust-toolchain.toml`, `.nvmrc`, and the `packageManager` field of `package.json`.

## Local development (host)

```sh
corepack enable
pnpm install
pnpm dev        # Launch the Tauri app
```

Developing on a Linux host requires the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Build and test in a container

Checks and builds can run in the same environment as CI. Launch the GUI on the host.

```sh
docker compose build
docker compose run --rm build pnpm install --frozen-lockfile
docker compose run --rm build pnpm ci:all        # Lint, typecheck, test, build, fmt, clippy, and cargo test
docker compose run --rm build pnpm bundle:linux  # deb / rpm / AppImage
```

VS Code and Cursor Dev Containers use the same image (`.devcontainer/devcontainer.json`).

## Local HTTP API (extension integration)

While the desktop app is running, it serves an API for the extension on `127.0.0.1:41600`. Paths and types are defined in `packages/shared/src/api.ts`.

| Endpoint | Description |
|---|---|
| `GET /api/app/info` | Returns `AppInfo` |
| `POST /api/items?name=&ext=&url=` | Imports the binary request body into the open library and returns `ItemMetadata` with status `201`. When `ext` is omitted, it is chosen from `Content-Type` |

Errors are returned as `{ "code", "message" }` (`ApiError`). When no library is open, the status is `503`. A request is rejected with `403` when the client is outside loopback, `Host` is not localhost, or `Origin` is not a `chrome-extension://` URL.

## Developing with AI agents

Conventions and the steps from an issue to a pull request are in `AGENTS.md` and `.agents/skills/issue-to-pr/SKILL.md`. Cursor and Codex load these as skills. Claude Code follows `CLAUDE.md`, which points at `AGENTS.md`. Helper scripts are under `scripts/agent/`.

In a worktree created with Orca, implementation is handed to a Cursor Cloud Agent. The setup in `orca.yaml` replaces `.cursor/cli.json` with `scripts/agent/cloud-only.cli.json`, which blocks the local `cursor-agent` from writing files, building, testing, committing, and pushing. When the worktree is created with a linked issue, the agent calls `scripts/agent/cloud-run.sh` to start a Cloud Agent and reports its URL.

- The Cloud Agent runs in the same `docker/build.Dockerfile` image as CI, configured by `.cursor/environment.json`
- Set `CURSOR_API_KEY` (created under API Keys on the Cursor Dashboard) in the shell that launches Orca
- To let the Cloud Agent use `gh`, set a fine-grained token scoped to this repository as `SWALLOW_CLOUD_GH_TOKEN`. When it is unset, Cursor still opens the pull request automatically
- The block lists the main commands. Writes made through the shell are outside that list

## CI

| Workflow | Description |
|---|---|
| `build-image.yml` | Pushes the build image to GHCR, tagged with a hash of its input files (an existing image is reused) |
| `ci.yml` | Runs `pnpm ci:all` and a deb build in a container, plus native builds on macOS and Windows runners |
| `release.yml` | On a `v*` tag, attaches Linux, macOS (arm64 and x64), and Windows installers to a draft release |

Tauri does not support cross-compilation, so macOS and Windows builds run on runners for those operating systems.

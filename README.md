# Swallow

A material management application. It consists of a Tauri 2 + React + TypeScript desktop app and a Chrome extension.

## Layout

| Path                      | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `apps/desktop`            | Tauri 2 app (`src` is React, `src-tauri` is Rust)           |
| `packages/shared`         | Types shared by the desktop app and the extension           |
| `docker/build.Dockerfile` | Build environment shared by CI, Compose, and Dev Containers |

Tool versions are pinned in `rust-toolchain.toml`, `.nvmrc`, and the `packageManager` field of `package.json`.

## Local development (host)

Requires **Node 22+** (`corepack` / pnpm), the **Rust toolchain** from `rust-toolchain.toml` (`rustup` recommended), and on Linux the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

```sh
corepack enable
pnpm install
pnpm dev        # Launch the Tauri app (needs cargo on PATH)
```

Without Rust on the host, use the container workflow below or a Dev Container instead of `pnpm dev` / `pnpm ci:all`.

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

| Endpoint                          | Description                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/app/info`               | Returns `AppInfo`                                                                                                                                           |
| `POST /api/items?name=&ext=&url=` | Imports the binary request body into the open library and returns `ItemMetadata` with status `201`. When `ext` is omitted, it is chosen from `Content-Type` |

Errors are returned as `{ "code", "message" }` (`ApiError`). When no library is open, the status is `503`. A request is rejected with `403` when the client is outside loopback, `Host` is not localhost, `Origin` is missing, or `Origin` is not a `chrome-extension://` URL.

## Developing with AI agents

Conventions and the steps from an issue to a pull request are in `AGENTS.md` and `.agents/skills/issue-to-pr/SKILL.md`. Cursor and Codex load these as skills. Claude Code follows `CLAUDE.md`, which points at `AGENTS.md`. Helper scripts are under `scripts/agent/`.

In a worktree created with Orca, implementation is handed to a Cursor Cloud Agent. The setup in `orca.yaml` replaces `.cursor/cli.json` with `scripts/agent/cloud-only.cli.json`, which blocks the local `cursor-agent` from writing files, building, testing, committing, and pushing. When the worktree is created with a linked issue, the agent calls `scripts/agent/cloud-run.sh` to start a Cloud Agent and reports its URL.

**Cloud Agent environment:** `.cursor/environment.json` points at the same `docker/build.Dockerfile` as CI. When a successful **environment build** exists, agents boot from that snapshot (Node, Rust, and Tauri Linux deps already installed). If no build is available yet, Cursor may start on a generic image instead; `install` then runs `scripts/agent/environment-install.sh`, which installs `pnpm` dependencies and, when `cargo` is missing, Rust via `rustup` from `rust-toolchain.toml`. GUI `pnpm dev` on a bare Linux VM still needs Tauri system packages—prefer the Docker / Dev Container path for full desktop builds.

- Copy `.env.example` to `.env` on the host that runs Orca (do not commit `.env`). See [Environment variables](#environment-variables) below.
- Set `CURSOR_API_KEY` (Cursor Dashboard → API Keys) before `scripts/agent/cloud-run.sh`
- To let the Cloud Agent use `gh` for Issues and labels, provide a repository-scoped token: on the host use `SWALLOW_CLOUD_GH_TOKEN` (mapped to `GH_TOKEN` inside the agent), or set Runtime Secret **`GH_TOKEN`** on the Cloud Agent directly
- When no GitHub token is set, Cursor still opens the pull request automatically in many cases
- These restrictions list the main commands. Writes through the shell remain possible

## Environment variables

Repository-local secrets and agent tokens are documented in `.env.example` (Japanese comments). Overview:

| Purpose                           | Name you set (host / Dashboard)             | Name read at runtime    | Required              | Notes                                                                   |
| --------------------------------- | ------------------------------------------- | ----------------------- | --------------------- | ----------------------------------------------------------------------- |
| Cloud Agents API (`cloud-run.sh`) | `CURSOR_API_KEY`                            | same                    | Yes for Orca launches | Shell or `.env` on the machine running Orca                             |
| GitHub API inside Cloud Agent     | **`GH_TOKEN`** (recommended Runtime Secret) | `GH_TOKEN`              | No                    | Fine-grained PAT scoped to this repo; enables `gh issue` / label writes |
| Same token from Orca host only    | `SWALLOW_CLOUD_GH_TOKEN`                    | → `GH_TOKEN` in agent   | No                    | Set in shell or `.env`; `cloud-run.sh` maps it when starting the agent  |
| Parallel worktrees                | `SWALLOW_WORKTREE_DIR`                      | same                    | No                    | `start-issue.sh --worktree` parent directory                            |
| Taxonomy bootstrap target         | `REPO`                                      | same                    | No                    | Default `hk-pG/swallow`; `github-taxonomy-setup.sh`                     |
| Rust / Compose image              | `CARGO_HOME`, `RUSTUP_HOME`                 | same                    | No                    | Set in `docker/build.Dockerfile`; agents usually inherit                |
| Tauri dev build                   | `TAURI_DEV_HOST`, `TAURI_ENV_*`             | same                    | No                    | Set by `pnpm dev` / Tauri CLI, not usually in `.env`                    |
| GitHub Actions CI                 | `GITHUB_TOKEN`                              | `GH_TOKEN` in some jobs | CI only               | Provided by Actions; not for local `.env`                               |

Agent onboarding details: [`docs/HANDOFF.md`](docs/HANDOFF.md) §6.

## CI

| Workflow          | Description                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `build-image.yml` | Pushes the build image to GHCR, tagged with a hash of its input files (an existing image is reused) |
| `ci.yml`          | Runs `pnpm ci:all` and a deb build in a container, plus native builds on macOS and Windows runners  |
| `release.yml`     | On a `v*` tag, attaches Linux, macOS (arm64 and x64), and Windows installers to a draft release     |

Tauri does not support cross-compilation, so macOS and Windows builds run on runners for those operating systems.

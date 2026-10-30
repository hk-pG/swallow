#!/usr/bin/env bash
# Cloud Agent / environment build bootstrap (see .cursor/environment.json).
# Installs Rust when cargo is missing so ci:all and rust:* work without the Docker build image.

set -euo pipefail

source "$(dirname "$0")/lib.sh"

cd "$(repo_root)"
prepend_toolchain_path

ensure_rust() {
  if command -v cargo >/dev/null 2>&1; then
    rustup toolchain install
    return 0
  fi

  info "cargo not in PATH; installing Rust via rustup (rust-toolchain.toml)"
  info "pnpm dev on Linux also needs Tauri system packages — see README and https://v2.tauri.app/start/prerequisites/"

  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --profile minimal --default-toolchain none
  prepend_toolchain_path
  rustup toolchain install
  command -v cargo >/dev/null 2>&1 || die "rustup finished but cargo is still missing"
}

ensure_rust

info "installing Node dependencies"
pnpm install --frozen-lockfile

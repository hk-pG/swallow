#!/usr/bin/env bash
# Usage: scripts/agent/check-rust.sh
#
# Rust-only checks (fmt, clippy, test). Use while iterating on src-tauri;
# run scripts/agent/check.sh before opening a PR.

source "$(dirname "$0")/lib.sh"

cd "$(repo_root)"
prepend_toolchain_path

if [[ ! -d node_modules || pnpm-lock.yaml -nt node_modules/.modules.yaml ]]; then
  info "installing dependencies"
  pnpm install --frozen-lockfile
fi

if ! command -v cargo >/dev/null 2>&1; then
  die "cargo not found; use Dev Container, docker compose build, or scripts/agent/environment-install.sh"
fi

log=$(check_log_path)
info "running pnpm ci:rust (log: $log)"
if ! pnpm ci:rust 2>&1 | tee "$log"; then
  die "rust checks failed; see $log"
fi

info "rust checks passed"

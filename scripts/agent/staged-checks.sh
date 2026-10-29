# shellcheck shell=bash
# Shared light checks for staged files. Sourced by review-staged.sh and run-pre-commit.sh.
# Do not put full ci:all here — that stays in check.sh.

# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# Cloud / CI images often keep rustup tools off the default PATH.
export PATH="${CARGO_HOME:-$HOME/.cargo}/bin:/usr/local/cargo/bin:${PATH:-/usr/bin:/bin}"

# List staged paths (Added/Copied/Modified), NUL-safe via lines without newlines in repo paths.
staged_files() {
  git diff --cached --name-only --diff-filter=ACMR
}

staged_js_files() {
  staged_files | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|css|md)$' || true
}

staged_rs_files() {
  staged_files | grep -E '\.rs$' || true
}

# Biome on staged files only (Biome native --staged). No-op when nothing applicable.
run_biome_on_staged() {
  if ! command -v pnpm >/dev/null 2>&1; then
    die "pnpm not found; install deps before committing"
  fi
  # --no-errors-on-unmatched: empty / non-JS stages should not fail
  info "biome check --staged"
  (cd "$(repo_root)" && pnpm exec biome check --staged --no-errors-on-unmatched)
}

# rustfmt --check on staged .rs only. Skips when none staged or rustfmt missing.
run_rustfmt_on_staged() {
  local files
  files=$(staged_rs_files)
  if [[ -z $files ]]; then
    return 0
  fi
  if ! command -v rustfmt >/dev/null 2>&1; then
    die "rustfmt not found but .rs files are staged; install the Rust toolchain (rust-toolchain.toml)"
  fi
  info "rustfmt --check (staged .rs)"
  # edition matches workspace Cargo.toml
  # shellcheck disable=SC2086
  echo "$files" | tr '\n' '\0' | xargs -0 rustfmt --check --edition 2024
}

run_staged_mechanical_checks() {
  run_biome_on_staged
  run_rustfmt_on_staged
}

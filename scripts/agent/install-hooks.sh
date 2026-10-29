#!/usr/bin/env bash
# Usage: scripts/agent/install-hooks.sh
#
# Points this clone at .githooks (Biome / rustfmt pre-commit). When Cursor Cloud
# Agent has wrapped core.hooksPath with its dispatcher, updates the dispatcher's
# "original hooks" path so both the secrets scanner and repo hooks run.

# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "==> skip hook install (not a git work tree)" >&2
  exit 0
fi

cd "$(repo_root)"

hooks_abs=$(cd .githooks && pwd)
chmod +x .githooks/pre-commit scripts/agent/review-staged.sh scripts/agent/run-pre-commit.sh scripts/agent/install-hooks.sh

current=$(git config --local --get core.hooksPath 2>/dev/null || true)
# Relative hooksPath is resolved from the work tree by git; also try absolute.
resolve_hooks_dir() {
  local p=$1
  if [[ -z $p ]]; then
    echo ""
    return
  fi
  if [[ $p == /* ]]; then
    echo "$p"
  else
    echo "$(repo_root)/$p"
  fi
}

current_dir=$(resolve_hooks_dir "$current")

if [[ -n $current_dir && -f "$current_dir/.dispatcher" && -f "$current_dir/.cursor-original-hooks-path" ]]; then
  # Keep Cursor's hooksPath; make the dispatcher chain into our .githooks.
  printf '%s\n' "$hooks_abs" >"$current_dir/.cursor-original-hooks-path"
  info "Cursor agent-hooks detected; original hooks path -> $hooks_abs"
else
  git config --local core.hooksPath .githooks
  info "core.hooksPath=.githooks"
fi

info "pre-commit hook installed"

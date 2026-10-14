#!/usr/bin/env bash
# Usage: scripts/agent/check.sh
#
# Runs the same checks as CI (`pnpm ci:all`). On success, records the tree that passed
# so open-pr.sh can confirm the committed code is exactly what was checked.

source "$(dirname "$0")/lib.sh"

cd "$(repo_root)"

if [[ ! -d node_modules || pnpm-lock.yaml -nt node_modules/.modules.yaml ]]; then
  info "installing dependencies"
  pnpm install --frozen-lockfile
fi

stamp=$(check_stamp_path)
log=$(check_log_path)
rm -f "$stamp"

tree=$(worktree_tree)
info "running pnpm ci:all (log: $log)"
if ! pnpm ci:all 2>&1 | tee "$log"; then
  die "checks failed; see $log"
fi

if [[ $(worktree_tree) != "$tree" ]]; then
  die "files changed while checks were running; run check.sh again"
fi

echo "$tree" >"$stamp"
info "all checks passed"

# shellcheck shell=bash
# Sourced by the other scripts in scripts/agent/.

set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

info() {
  echo "==> $*" >&2
}

# Docker / rustup often set CARGO_HOME without updating non-interactive PATH.
prepend_toolchain_path() {
  local env_file
  for env_file in /usr/local/cargo/env "${HOME}/.cargo/env"; do
    if [[ -f "$env_file" ]]; then
      # shellcheck disable=SC1090
      . "$env_file"
    fi
  done
  if [[ -n "${CARGO_HOME:-}" && -d "${CARGO_HOME}/bin" ]]; then
    export PATH="${CARGO_HOME}/bin:${PATH}"
  fi
}

repo_root() {
  git rev-parse --show-toplevel
}

# Tree hash of the working directory as it would be committed with `git add -A`.
# Uses a throwaway index so the real index is untouched.
worktree_tree() {
  local tmp
  tmp=$(mktemp)
  cp "$(git rev-parse --git-path index)" "$tmp" 2>/dev/null || true
  GIT_INDEX_FILE="$tmp" git add -A >/dev/null
  GIT_INDEX_FILE="$tmp" git write-tree
  rm -f "$tmp"
}

# Per-worktree file recording the tree that last passed check.sh.
check_stamp_path() {
  git rev-parse --git-path agent-check-passed
}

check_log_path() {
  git rev-parse --git-path agent-check.log
}

# Open PRs whose body links the issue (Closes/Fixes/Resolves/Refs #N).
prs_linking_issue() {
  local issue=$1
  gh pr list --state open --limit 100 --json number,headRefName,url,body \
    --jq ".[] | select(.body | test(\"(?i)(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?) #${issue}\\\\b\")) | \"#\\(.number) \\(.headRefName) \\(.url)\""
}

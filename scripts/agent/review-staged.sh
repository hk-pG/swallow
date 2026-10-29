#!/usr/bin/env bash
# Usage: scripts/agent/review-staged.sh
#
# Commit-time review helper: requires a non-empty staged diff, prints a semantic
# checklist, then runs the same light mechanical checks as .githooks/pre-commit.
# Agents must run this after `git add` and before `git commit`.

# shellcheck source=staged-checks.sh
source "$(dirname "$0")/staged-checks.sh"

cd "$(repo_root)"

if [[ -z $(git diff --cached --name-only) ]]; then
  die "nothing staged; run git add first, then review-staged.sh before commit"
fi

info "staged files"
git diff --cached --name-only >&2
echo >&2

cat <<'EOF' >&2
==> semantic checklist (read git diff --cached, then confirm)
  - 受け入れ条件をこの差分で進めているか。関係ない変更が混ざっていないか
  - デバッグ用のコード、一時ファイル、秘密情報が混ざっていないか
  - エラー時の挙動（存在しない ID、壊れた JSON、ライブラリ未オープン）を考えたか
  - 振る舞い変更ならテストを追加・更新したか

EOF

# Soft warnings only (do not fail — Biome/rustfmt are the hard gate).
# Exclude this script so the pattern literals here do not self-match.
warn_patterns() {
  local hit
  hit=$(
    git diff --cached -U0 -- . ':(exclude)scripts/agent/review-staged.sh' |
      grep -E '^\+' | grep -Ev '^\+\+\+' | grep -E 'TODO\(agent\)|FIXME\(agent\)' || true
  )
  if [[ -n $hit ]]; then
    echo "warning: staged diff mentions TODO(agent)/FIXME(agent):" >&2
    echo "$hit" >&2
  fi
}
warn_patterns

run_staged_mechanical_checks

info "mechanical checks passed — finish the checklist above, then git commit"
info "do not use --no-verify to skip hooks"

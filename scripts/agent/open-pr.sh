#!/usr/bin/env bash
# Usage: scripts/agent/open-pr.sh --title "<conventional title>" --body-file <path> [--draft]
#
# Verifies the branch is ready, pushes it, and opens a PR against main.
# If a PR already exists for the branch, pushes and prints its URL instead.

source "$(dirname "$0")/lib.sh"

title=""
body_file=""
draft=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --title) title=${2:?--title requires a value}; shift 2 ;;
    --body-file) body_file=${2:?--body-file requires a value}; shift 2 ;;
    --draft) draft=(--draft); shift ;;
    -h | --help) sed -n '2,5p' "$0"; exit 0 ;;
    *) die "unexpected argument: $1" ;;
  esac
done

[[ -n $title ]] || die "--title is required"
[[ -f $body_file ]] || die "--body-file is required and must exist"

types="feat|fix|refactor|perf|test|docs|build|ci|chore|style|revert"
[[ $title =~ ^($types)(\([a-z0-9-]+\))?!?:\ .+ ]] ||
  die "title must be Conventional Commits: <type>(<scope>): <summary>  (types: $types)"

grep -qiE '(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?) #[0-9]+' "$body_file" ||
  die "body must link the issue (e.g. 'Closes #22' or 'Refs #22')"
! grep -qE '^Closes #$' "$body_file" || die "body still has the template placeholder 'Closes #'"

branch=$(git branch --show-current)
[[ -n $branch ]] || die "detached HEAD"
[[ $branch != main ]] || die "refusing to open a PR from main"

[[ -z $(git status --porcelain) ]] || die "working tree is dirty; commit or discard changes first"

git fetch --quiet origin main
git merge-base --is-ancestor origin/main HEAD ||
  die "branch is behind origin/main; run 'git rebase origin/main', then check.sh again"
[[ -n $(git rev-list origin/main..HEAD) ]] || die "no commits ahead of origin/main"

stamp=$(check_stamp_path)
[[ -f $stamp && $(cat "$stamp") == "$(git rev-parse 'HEAD^{tree}')" ]] ||
  die "HEAD has not passed checks; run scripts/agent/check.sh"

info "pushing $branch"
git push --quiet --set-upstream origin "$branch"

if url=$(gh pr view "$branch" --json url,state --jq 'select(.state == "OPEN") | .url' 2>/dev/null) && [[ -n $url ]]; then
  info "PR already exists; pushed new commits"
  echo "$url"
  exit 0
fi

gh pr create --base main --head "$branch" --title "$title" --body-file "$body_file" ${draft[@]+"${draft[@]}"}

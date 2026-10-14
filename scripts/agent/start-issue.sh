#!/usr/bin/env bash
# Usage: scripts/agent/start-issue.sh <issue-number> [--slug <slug>] [--worktree] [--force]
#
# Prepares a branch for the issue and prints the issue with its comments and linked issues.
#   on main     creates issue-<N>[-<slug>] from the latest origin/main and switches to it
#   on a branch uses the current branch as is (e.g. a worktree Orca created for the issue)
#   --worktree  create a separate git worktree for issue-<N>[-<slug>] instead
#               (under $SWALLOW_WORKTREE_DIR, default ../<repo>-worktrees)
#   --force     continue even if another branch or open PR already targets the issue

source "$(dirname "$0")/lib.sh"

issue=""
slug=""
use_worktree=false
force=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --slug) slug=${2:?--slug requires a value}; shift 2 ;;
    --worktree) use_worktree=true; shift ;;
    --force) force=true; shift ;;
    -h | --help) sed -n '2,10p' "$0"; exit 0 ;;
    *) [[ -z $issue ]] || die "unexpected argument: $1"; issue=$1; shift ;;
  esac
done

[[ $issue =~ ^[0-9]+$ ]] || die "issue number is required (e.g. start-issue.sh 22)"
[[ -z $slug || $slug =~ ^[a-z0-9-]+$ ]] || die "--slug must match [a-z0-9-]+"

state=$(gh issue view "$issue" --json state --jq .state) || die "issue #$issue not found"
[[ $state == OPEN ]] || die "issue #$issue is $state"

info "fetching origin"
git fetch --quiet origin main

current=$(git branch --show-current)
if $use_worktree || [[ $current == main ]]; then
  branch="issue-$issue${slug:+-$slug}"
  git show-ref --verify --quiet "refs/heads/$branch" && die "local branch $branch already exists"
else
  [[ -n $current ]] || die "detached HEAD; switch to main or a branch first"
  branch=$current
fi

existing_branches=$(git ls-remote --heads origin "issue-$issue" "issue-$issue-*" |
  awk '{print $2}' | sed 's|refs/heads/||' | grep -vx "$branch" || true)
existing_prs=$(prs_linking_issue "$issue" | awk -v b="$branch" '$2 != b' || true)
if [[ -n $existing_branches || -n $existing_prs ]]; then
  echo "issue #$issue already has work in progress:" >&2
  [[ -z $existing_branches ]] || echo "  remote branches: $existing_branches" >&2
  [[ -z $existing_prs ]] || echo "  open PRs: $existing_prs" >&2
  $force || die "pass --force to start anyway"
fi

if $use_worktree; then
  root=$(repo_root)
  path="${SWALLOW_WORKTREE_DIR:-$(dirname "$root")/$(basename "$root")-worktrees}/$branch"
  git worktree add --quiet --no-track -b "$branch" "$path" origin/main
  info "created worktree $path"
  info "run 'pnpm install --frozen-lockfile' there before checking"
  workdir=$path
elif [[ $branch != "$current" ]]; then
  [[ -z $(git status --porcelain) ]] || die "working tree is dirty; commit/stash first or use --worktree"
  git switch --quiet --no-track -c "$branch" origin/main
  workdir=$(repo_root)
else
  workdir=$(repo_root)
  git merge-base --is-ancestor origin/main HEAD ||
    info "warning: $branch is behind origin/main; consider 'git rebase origin/main'"
fi

info "branch $branch in $workdir"
echo

gh issue view "$issue" --json number,title,url,labels,body,comments --jq '
  "# #\(.number) \(.title)\n\(.url)\nlabels: \([.labels[].name] | join(", "))\n\n\(.body)",
  (.comments[] | "\n--- comment by \(.author.login) at \(.createdAt) ---\n\(.body)")'

linked=$(gh issue view "$issue" --json body --jq .body | grep -oE '#[0-9]+' | tr -d '#' | sort -un | grep -vx "$issue" || true)
if [[ -n $linked ]]; then
  echo
  echo "--- linked issues/PRs ---"
  for n in $linked; do
    gh issue view "$n" --json number,title,state --jq '"#\(.number) [\(.state)] \(.title)"' 2>/dev/null ||
      gh pr view "$n" --json number,title,state --jq '"#\(.number) [PR \(.state)] \(.title)"' 2>/dev/null ||
      true
  done
fi

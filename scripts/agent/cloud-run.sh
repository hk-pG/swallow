#!/usr/bin/env bash
# Usage: scripts/agent/cloud-run.sh <issue-number-or-url> [--model <id>] [--force] [--dry-run]
#
# Starts a Cursor Cloud Agent that takes the issue to a PR with the issue-to-pr skill,
# and prints the agent URL. Requires CURSOR_API_KEY (Cursor Dashboard -> API Keys).
#   SWALLOW_CLOUD_GH_TOKEN  passed to the agent as GH_TOKEN so it can use gh (scope it to this repo)
#   --model                 model id from GET /v1/models (default: your Cursor default)
#   --force                 start even if an open PR already links the issue
#   --dry-run               print the request body instead of sending it

source "$(dirname "$0")/lib.sh"

issue=""
model=""
force=false
dry_run=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --model) model=${2:?--model requires a value}; shift 2 ;;
    --force) force=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    -h | --help) sed -n '2,9p' "$0"; exit 0 ;;
    *) [[ -z $issue ]] || die "unexpected argument: $1"; issue=$1; shift ;;
  esac
done

issue=${issue##*/}
issue=${issue#\#}
[[ $issue =~ ^[0-9]+$ ]] || die "issue number or URL is required (e.g. cloud-run.sh 22)"
$dry_run || [[ -n ${CURSOR_API_KEY:-} ]] || die "CURSOR_API_KEY is not set"

state=$(gh issue view "$issue" --json state --jq .state) || die "issue #$issue not found"
[[ $state == OPEN ]] || die "issue #$issue is $state"

existing_prs=$(prs_linking_issue "$issue")
if [[ -n $existing_prs ]]; then
  echo "issue #$issue already has open PRs: $existing_prs" >&2
  $force || die "pass --force to start anyway"
fi

repo_url=$(gh repo view --json url --jq .url)
issue_text=$(gh issue view "$issue" --json number,title,url,body,comments --jq '
  "# #\(.number) \(.title)\n\(.url)\n\n\(.body)",
  (.comments[] | "\n--- comment by \(.author.login) at \(.createdAt) ---\n\(.body)")')

prompt=$(
  cat <<EOF
GitHub Issue #$issue を、リポジトリの .agents/skills/issue-to-pr/SKILL.md の手順に従って PR 作成まで進めてください。

- 作業ブランチは用意されたものをそのまま使う。start-issue.sh はこのブランチ上でオプションなしで実行する
- 最初に gh auth status を確認する。通らなければ start-issue.sh と open-pr.sh は実行せず、Issue の内容は下に貼ったものを使う。check.sh が通った状態でコミットまで行えば PR は自動で作られるので、PR テンプレートに沿った本文を最後の報告に書く

$issue_text
EOF
)

body=$(jq -n \
  --arg text "$prompt" \
  --arg name "#$issue $(gh issue view "$issue" --json title --jq .title)" \
  --arg repo "$repo_url" \
  --arg model "$model" \
  --arg gh_token "${SWALLOW_CLOUD_GH_TOKEN:-}" \
  '{
    prompt: {text: $text},
    name: $name[:100],
    repos: [{url: $repo, startingRef: "main"}],
    autoCreatePR: true
  }
  + (if $model != "" then {model: {id: $model}} else {} end)
  + (if $gh_token != "" then {envVars: {GH_TOKEN: $gh_token}} else {} end)')

if $dry_run; then
  jq 'if .envVars then .envVars.GH_TOKEN = "***" else . end' <<<"$body"
  exit 0
fi

info "starting a cloud agent for issue #$issue"
response=$(curl -sS --fail-with-body \
  --config <(printf 'user = "%s:"\n' "$CURSOR_API_KEY") \
  -H 'Content-Type: application/json' \
  --data @- https://api.cursor.com/v1/agents <<<"$body") ||
  die "Cloud Agents API request failed: $response"

jq -r '"agent: \(.agent.id)\nrun:   \(.run.id) (\(.run.status))\n\(.agent.url)"' <<<"$response"

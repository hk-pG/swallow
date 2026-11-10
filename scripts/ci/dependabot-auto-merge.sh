#!/usr/bin/env bash
# Dependabot PR を squash マージする。
# main には必須ステータスチェックが無く、Allow auto-merge も無効なため
# GitHub の auto-merge は使わない。CI の checks（pnpm ci:all）が
# この head SHA で success になるまで待ってからマージする。
# skipped はテスト未実行なので成功扱いにしない。

set -euo pipefail

: "${PR_URL:?PR_URL is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"
: "${REPO:?REPO is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

interval="${POLL_INTERVAL_SECONDS:-20}"
timeout_seconds="${WAIT_TIMEOUT_SECONDS:-3600}"

if ! [[ "$interval" =~ ^[0-9]+$ ]]; then
  echo "POLL_INTERVAL_SECONDS が不正です: ${interval}" >&2
  exit 1
fi
if ! [[ "$timeout_seconds" =~ ^[0-9]+$ && "$timeout_seconds" -ge 1 ]]; then
  echo "WAIT_TIMEOUT_SECONDS が不正です: ${timeout_seconds}" >&2
  exit 1
fi
if ! [[ "$HEAD_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "HEAD_SHA が commit SHA ではありません" >&2
  exit 1
fi
if ! [[ "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
  echo "REPO が owner/name ではありません" >&2
  exit 1
fi

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
classifier="${script_dir}/dependabot-check-state.mjs"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh が見つかりません" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node が見つかりません" >&2
  exit 1
fi

current_head() {
  gh pr view "$PR_URL" --json headRefOid --jq .headRefOid
}

checks_state() {
  local payload
  # 同一 SHA の再実行が 100 件を超えることは想定しない（この取得は 1 ページ）。
  if ! payload=$(gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs?check_name=checks&per_page=100"); then
    printf '%s\n' "error"
    return 0
  fi
  printf '%s\n' "$payload" | node "$classifier"
}

echo "CI ジョブ checks が ${HEAD_SHA} で success になるまで待ちます（最大 ${timeout_seconds}s）"

deadline=$((SECONDS + timeout_seconds))
while true; do
  if ! head_now=$(current_head); then
    echo "head SHA の取得に失敗しました。再試行します" >&2
    if ((SECONDS >= deadline)); then
      echo "時間内に head SHA を取得できませんでした" >&2
      exit 1
    fi
    sleep "$interval"
    continue
  fi

  if [[ "$head_now" != "$HEAD_SHA" ]]; then
    echo "head が ${HEAD_SHA} から ${head_now} に変わったため、この実行ではマージしません"
    exit 0
  fi

  state=$(checks_state)
  echo "checks state=${state}"

  case "$state" in
    success) break ;;
    missing | pending | error)
      if ((SECONDS >= deadline)); then
        echo "時間内に CI の checks が成功しませんでした（最後の状態: ${state}）" >&2
        exit 1
      fi
      sleep "$interval"
      ;;
    skipped)
      echo "CI の checks がスキップされたためマージしません。pnpm ci:all が走っていません。" >&2
      exit 1
      ;;
    cancelled)
      # 新しい push で CI がキャンセルされた直後は、head の反映が一段遅れることがある。
      sleep "$interval"
      if head_now=$(current_head) && [[ "$head_now" != "$HEAD_SHA" ]]; then
        echo "head が ${HEAD_SHA} から ${head_now} に変わったため、この実行ではマージしません"
        exit 0
      fi
      echo "CI の checks がキャンセルされたためマージしません" >&2
      exit 1
      ;;
    *)
      echo "CI の checks が成功していないためマージしません（conclusion=${state}）" >&2
      exit 1
      ;;
  esac
done

if ! head_now=$(current_head); then
  echo "マージ直前の head SHA 取得に失敗しました" >&2
  exit 1
fi
if [[ "$head_now" != "$HEAD_SHA" ]]; then
  echo "マージ直前に head が ${head_now} に変わったためマージしません"
  exit 0
fi

# auto-merge は使わない。必須チェックが無いと、有効化した瞬間に未テストでマージされる。
# --match-head-commit で、待っていた SHA 以外は拒否する。
gh pr merge "$PR_URL" --squash --match-head-commit "$HEAD_SHA"

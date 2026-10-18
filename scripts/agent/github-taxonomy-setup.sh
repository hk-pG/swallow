#!/usr/bin/env bash
# Swallow リポ: マイルストーン・ラベル作成と既存 Issue への付与
# リポジトリ権限のあるアカウントで実行すること（cursor[bot] は 403 になる）。
#
# 使い方:
#   bash scripts/agent/github-taxonomy-setup.sh
#
# 前提: gh auth login 済み、repo の Issues 書き込み権限あり
# やらないこと: Issue 本文の編集、クローズ、PR 操作
# 詳細: docs/github-tracking.md / docs/HANDOFF.md

set -euo pipefail

REPO="${REPO:-hk-pG/swallow}"

echo "==> repo: $REPO"

# ---------------------------------------------------------------------------
# 1. マイルストーン（無ければ作成）
# ---------------------------------------------------------------------------
ensure_milestone() {
  local title="$1"
  local desc="$2"
  local existing
  existing="$(gh api "repos/$REPO/milestones" --paginate \
    --jq ".[] | select(.title==\"$title\") | .number" | head -n1)"
  if [[ -n "$existing" ]]; then
    echo "  milestone exists: $title (#$existing)"
  else
    gh api "repos/$REPO/milestones" \
      -f title="$title" \
      -f description="$desc" \
      -f state=open \
      --jq '"  created milestone: \(.title) (#\(.number))"'
  fi
}

echo "==> milestones"
ensure_milestone "alpha" "α スコープ（ほぼ完了扱い）"
ensure_milestone "beta" "P1/P2 機能（beta 前半・後半）"
ensure_milestone "backlog" "P3 後続・対象外寄り"

# ---------------------------------------------------------------------------
# 2. ラベル（無ければ作成）
# ---------------------------------------------------------------------------
ensure_label() {
  local name="$1"
  local color="$2"
  local desc="$3"
  if gh label list --repo "$REPO" --limit 200 --json name \
    --jq ".[].name" | grep -Fxq "$name"; then
    echo "  label exists: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc"
    echo "  created label: $name"
  fi
}

echo "==> labels"
ensure_label "P1" "B60205" "beta 前半（最優先）"
ensure_label "P2" "D93F0B" "beta 後半"
ensure_label "P3" "FBCA04" "後続・優先度低"
ensure_label "area:desktop" "1D76DB" "デスクトップアプリ（Tauri/React）"
ensure_label "area:extension" "5319E7" "Chrome 拡張（別リポ予定）"
ensure_label "area:ci" "0E8A16" "CI / ビルド・パイプライン"
# enhancement は既存。無ければ作る
ensure_label "enhancement" "a2eeef" "New feature or request"

# ---------------------------------------------------------------------------
# 3. オープン Issue への付与（クローズ済みはスキップ）
# ---------------------------------------------------------------------------
assign_issue() {
  local num="$1"
  shift
  local labels=()
  local milestone=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --milestone) milestone="$2"; shift 2 ;;
      --label) labels+=("$2"); shift 2 ;;
      *) echo "unknown arg: $1" >&2; return 1 ;;
    esac
  done

  local state
  state="$(gh issue view "$num" --repo "$REPO" --json state --jq .state)"
  if [[ "$state" != "OPEN" ]]; then
    echo "  skip #$num (state=$state)"
    return 0
  fi

  local args=(gh issue edit "$num" --repo "$REPO")
  if [[ -n "$milestone" ]]; then
    args+=(--milestone "$milestone")
  fi
  local l
  for l in "${labels[@]}"; do
    args+=(--add-label "$l")
  done

  "${args[@]}"
  echo "  updated #$num → milestone=${milestone:-none} labels=${labels[*]}"
}

echo "==> assign issues (open only)"

# P1 / beta / desktop
for n in 34 35 49 50; do
  assign_issue "$n" --milestone beta --label P1 --label area:desktop --label enhancement
done

# P2 / beta / desktop
for n in 51 52 53 54 55 56; do
  assign_issue "$n" --milestone beta --label P2 --label area:desktop --label enhancement
done

# P3 / backlog / desktop
for n in 57 58; do
  assign_issue "$n" --milestone backlog --label P3 --label area:desktop --label enhancement
done

# 拡張・別リポ
assign_issue 12 --milestone backlog --label area:extension

# CI（機能外・P なし）
assign_issue 46 --milestone backlog --label area:ci

# α トラッカー
assign_issue 45 --milestone alpha

# MVP トラッカー（α に寄せる）
assign_issue 14 --milestone alpha

echo "==> done"
echo "確認: gh issue list --repo $REPO --state open --limit 50"

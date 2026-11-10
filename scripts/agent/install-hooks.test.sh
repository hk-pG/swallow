#!/usr/bin/env bash
# prepare が Windows の cmd.exe で落ちないことと、ラッパーが install-hooks.sh を実行することを検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

prepare=$(node -p "require('./package.json').scripts.prepare")
first=${prepare%% *}
case $first in
  */* | *\\*) fail "prepare の先頭トークンにパス区切りがある: $prepare" ;;
esac
[[ $first == node ]] || fail "prepare は node から起動する: $prepare"

# checks のコンテナでは git rev-parse が work tree を認めず、install-hooks.sh はスキップする。
# その環境ではスキップが exit 0 であることだけ確認する。
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  node ./scripts/agent/install-hooks.mjs
  echo "ok (not a git work tree)"
  exit 0
fi

# core.hooksPath が Cursor の dispatcher のときは、元の hooks パスを一時的に壊して復元を確認する。
current=$(git config --local --get core.hooksPath || true)
marker=""
if [[ -n $current && -f "$current/.dispatcher" && -f "$current/.cursor-original-hooks-path" ]]; then
  marker=$current/.cursor-original-hooks-path
  saved=$(cat "$marker")
  printf '%s\n' "/tmp/swallow-hooks-sentinel" >"$marker"
  trap 'printf "%s\n" "$saved" >"$marker"' EXIT
fi

node ./scripts/agent/install-hooks.mjs

if [[ -n $marker ]]; then
  restored=$(cat "$marker")
  case $restored in
    */.githooks) ;;
    *) fail "dispatcher の original hooks が .githooks ではない: $restored" ;;
  esac
  [[ $restored != /tmp/swallow-hooks-sentinel ]] || fail "install-hooks.sh が実行されていない"
else
  updated=$(git config --local --get core.hooksPath || true)
  [[ $updated == .githooks ]] || fail "core.hooksPath が .githooks ではない: ${updated:-<unset>}"
fi

echo "ok"

#!/usr/bin/env bash
# dependabot-auto-merge.sh のゲートを、本物の GitHub に触らず検証する。
# 環境変数はサブシェル内だけで上書きする（呼び出し元には戻さない）。
# shellcheck disable=SC2030,SC2031
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$root/../.." && pwd)
script="$root/dependabot-auto-merge.sh"
classifier="$root/dependabot-check-state.mjs"
workflow="$repo/.github/workflows/dependabot-auto-merge.yml"
sha="6a4714702d7173f7cabaafad0535bfa47c911820"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_eq() {
  local label=$1 actual=$2 expected=$3
  if [[ "$actual" != "$expected" ]]; then
    fail "$label: expected [$expected] actual [$actual]"
  fi
}

assert_state() {
  local expected=$1 json=$2
  local actual
  actual=$(printf '%s' "$json" | node "$classifier")
  assert_eq "check state" "$actual" "$expected"
}

assert_state missing '{"check_runs":[]}'
assert_state missing '{"check_runs":[{"name":"changes","status":"completed","conclusion":"success","started_at":"2026-11-02T17:48:00Z","id":1}]}'
assert_state pending '{"check_runs":[{"name":"checks","status":"in_progress","conclusion":null,"started_at":"2026-11-02T17:48:31Z","id":2}]}'
assert_state success '{"check_runs":[{"name":"checks","status":"completed","conclusion":"success","started_at":"2026-11-02T17:48:31Z","id":2}]}'
assert_state skipped '{"check_runs":[{"name":"checks","status":"completed","conclusion":"skipped","started_at":"2026-11-02T17:48:31Z","id":2}]}'
assert_state failure '{"check_runs":[{"name":"checks","status":"completed","conclusion":"failure","started_at":"2026-11-02T17:48:31Z","id":2}]}'
assert_state success '{"check_runs":[{"name":"checks","status":"completed","conclusion":"failure","started_at":"2026-11-02T17:48:31Z","id":1},{"name":"checks","status":"completed","conclusion":"success","started_at":"2026-11-02T18:00:00Z","id":2}]}'
assert_state failure '{"check_runs":[{"name":"checks","status":"completed","conclusion":"success","started_at":"2026-11-02T17:48:31Z","id":1},{"name":"checks","status":"completed","conclusion":"failure","started_at":"2026-11-02T18:00:00Z","id":2}]}'
assert_state pending '{"check_runs":[{"name":"checks","status":"completed","conclusion":"success","started_at":"2026-11-02T17:48:31Z","id":1},{"name":"checks","status":"in_progress","conclusion":null,"started_at":"2026-11-02T18:00:00Z","id":2}]}'
assert_state success '{"check_runs":[{"name":"checks","status":"completed","conclusion":"failure","started_at":"2026-11-02T18:00:00Z","id":1},{"name":"checks","status":"completed","conclusion":"success","started_at":"2026-11-02T18:00:00Z","id":2}]}'
assert_state error 'not-json'

make_fake_bin() {
  local dir=$1
  mkdir -p "$dir/bin" "$dir/mock"
  echo 0 >"$dir/mock/api_n"
  echo 0 >"$dir/mock/view_n"
  cat >"$dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
mock=${MOCK_DIR:?}
if [[ "${1:-}" == "api" ]]; then
  n=$(cat "$mock/api_n")
  echo $((n + 1)) >"$mock/api_n"
  if [[ -f "$mock/api-$n.fail" ]]; then
    echo "api failed" >&2
    exit 1
  fi
  if [[ -f "$mock/api-$n.json" ]]; then
    cat "$mock/api-$n.json"
    exit 0
  fi
  cat "$mock/api-last.json"
  exit 0
fi
if [[ "${1:-}" == "pr" && "${2:-}" == "view" ]]; then
  n=$(cat "$mock/view_n")
  echo $((n + 1)) >"$mock/view_n"
  if [[ -f "$mock/head-$n" ]]; then
    cat "$mock/head-$n"
    exit 0
  fi
  cat "$mock/head-last"
  exit 0
fi
if [[ "${1:-}" == "pr" && "${2:-}" == "merge" ]]; then
  shift 2
  printf '%s\n' "$*" >"$mock/merge.args"
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 99
EOF
  chmod +x "$dir/bin/gh"
}

run_case() {
  local dir=$1
  local expected_exit=$2
  shift 2
  local log code
  log=$(mktemp)
  set +e
  (
    export PATH="$dir/bin:$PATH"
    export MOCK_DIR="$dir/mock"
    export GH_TOKEN=test-token
    export PR_URL="https://github.com/hk-pG/swallow/pull/132"
    export HEAD_SHA="$sha"
    export REPO="hk-pG/swallow"
    export POLL_INTERVAL_SECONDS=0
    export WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS_CASE:-5}"
    bash "$script"
  ) >"$log" 2>&1
  code=$?
  set -e
  if [[ "$code" != "$expected_exit" ]]; then
    echo "---- output ----" >&2
    cat "$log" >&2
    fail "exit $code, expected $expected_exit"
  fi
  rm -f "$log"
}

success_json='{"check_runs":[{"name":"checks","status":"completed","conclusion":"success","started_at":"2026-11-02T17:48:31Z","id":2}]}'
pending_json='{"check_runs":[{"name":"checks","status":"in_progress","conclusion":null,"started_at":"2026-11-02T17:48:31Z","id":2}]}'
failure_json='{"check_runs":[{"name":"checks","status":"completed","conclusion":"failure","started_at":"2026-11-02T17:48:31Z","id":2}]}'
skipped_json='{"check_runs":[{"name":"checks","status":"completed","conclusion":"skipped","started_at":"2026-11-02T17:48:31Z","id":2}]}'
cancelled_json='{"check_runs":[{"name":"checks","status":"completed","conclusion":"cancelled","started_at":"2026-11-02T17:48:31Z","id":2}]}'

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# 成功した checks だけ squash し、auto-merge や admin は使わない。
make_fake_bin "$tmpdir/success"
printf '%s\n' "$sha" >"$tmpdir/success/mock/head-last"
printf '%s\n' "$success_json" >"$tmpdir/success/mock/api-last.json"
run_case "$tmpdir/success" 0
merge_args=$(cat "$tmpdir/success/mock/merge.args")
assert_eq "merge args" "$merge_args" "https://github.com/hk-pG/swallow/pull/132 --squash --match-head-commit $sha"
[[ "$merge_args" != *"--auto"* ]] || fail "auto flag present"
[[ "$merge_args" != *"--admin"* ]] || fail "admin flag present"

# 未登録 → 成功、になるまで待つ。
make_fake_bin "$tmpdir/wait"
printf '%s\n' "$sha" >"$tmpdir/wait/mock/head-last"
printf '%s\n' '{"check_runs":[]}' >"$tmpdir/wait/mock/api-0.json"
printf '%s\n' "$pending_json" >"$tmpdir/wait/mock/api-1.json"
printf '%s\n' "$success_json" >"$tmpdir/wait/mock/api-last.json"
run_case "$tmpdir/wait" 0
[[ -f "$tmpdir/wait/mock/merge.args" ]] || fail "expected merge after wait"

# 失敗・スキップ・キャンセルではマージしない。
for conclusion in failure skipped cancelled; do
  make_fake_bin "$tmpdir/$conclusion"
  printf '%s\n' "$sha" >"$tmpdir/$conclusion/mock/head-last"
  case "$conclusion" in
    failure) printf '%s\n' "$failure_json" >"$tmpdir/$conclusion/mock/api-last.json" ;;
    skipped) printf '%s\n' "$skipped_json" >"$tmpdir/$conclusion/mock/api-last.json" ;;
    cancelled) printf '%s\n' "$cancelled_json" >"$tmpdir/$conclusion/mock/api-last.json" ;;
  esac
  run_case "$tmpdir/$conclusion" 1
  [[ ! -f "$tmpdir/$conclusion/mock/merge.args" ]] || fail "merged on $conclusion"
done

# head が先に進んでいたらマージしない。
make_fake_bin "$tmpdir/moved"
printf '%s\n' "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" >"$tmpdir/moved/mock/head-last"
printf '%s\n' "$success_json" >"$tmpdir/moved/mock/api-last.json"
run_case "$tmpdir/moved" 0
[[ ! -f "$tmpdir/moved/mock/merge.args" ]] || fail "merged after head moved"

# 成功を確認した直後に head が変わったらマージしない。
make_fake_bin "$tmpdir/moved-late"
printf '%s\n' "$sha" >"$tmpdir/moved-late/mock/head-0"
printf '%s\n' "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" >"$tmpdir/moved-late/mock/head-last"
printf '%s\n' "$success_json" >"$tmpdir/moved-late/mock/api-last.json"
run_case "$tmpdir/moved-late" 0
[[ ! -f "$tmpdir/moved-late/mock/merge.args" ]] || fail "merged after late head move"

# API 失敗のあと成功したらマージする。
make_fake_bin "$tmpdir/retry"
printf '%s\n' "$sha" >"$tmpdir/retry/mock/head-last"
touch "$tmpdir/retry/mock/api-0.fail"
printf '%s\n' "$success_json" >"$tmpdir/retry/mock/api-last.json"
run_case "$tmpdir/retry" 0
[[ -f "$tmpdir/retry/mock/merge.args" ]] || fail "expected merge after api retry"

# checks が現れなければタイムアウトし、マージしない。
make_fake_bin "$tmpdir/timeout"
printf '%s\n' "$sha" >"$tmpdir/timeout/mock/head-last"
printf '%s\n' '{"check_runs":[]}' >"$tmpdir/timeout/mock/api-last.json"
WAIT_TIMEOUT_SECONDS_CASE=1 run_case "$tmpdir/timeout" 1
[[ ! -f "$tmpdir/timeout/mock/merge.args" ]] || fail "merged on timeout"

# 入力が壊れていたら gh を呼ばずに止まる。
make_fake_bin "$tmpdir/bad-sha"
(
  export GH_TOKEN=test-token
  export PR_URL="https://github.com/hk-pG/swallow/pull/132"
  export HEAD_SHA="not-a-sha"
  export REPO="hk-pG/swallow"
  export PATH="$tmpdir/bad-sha/bin:$PATH"
  export MOCK_DIR="$tmpdir/bad-sha/mock"
  set +e
  bash "$script" >/dev/null 2>&1
  code=$?
  set -e
  [[ "$code" == 1 ]] || fail "bad sha exit $code"
)
[[ "$(cat "$tmpdir/bad-sha/mock/api_n")" == "0" ]] || fail "bad sha called gh"

make_fake_bin "$tmpdir/bad-repo"
(
  export GH_TOKEN=test-token
  export PR_URL="https://github.com/hk-pG/swallow/pull/132"
  export HEAD_SHA="$sha"
  export REPO="not a repo"
  export PATH="$tmpdir/bad-repo/bin:$PATH"
  export MOCK_DIR="$tmpdir/bad-repo/mock"
  set +e
  bash "$script" >/dev/null 2>&1
  code=$?
  set -e
  [[ "$code" == 1 ]] || fail "bad repo exit $code"
)
[[ "$(cat "$tmpdir/bad-repo/mock/api_n")" == "0" ]] || fail "bad repo called gh"

# ワークフローは書き込み権限付きで PR ヘッドを実行しない。
[[ -f "$workflow" ]] || fail "workflow missing"
grep -q 'pull_request_target:' "$workflow" || fail "expected pull_request_target"
if grep -Eq '^[[:space:]]*pull_request:' "$workflow"; then
  fail "workflow must not use pull_request (read-only token)"
fi
grep -q '25dd0e34f4fe68f24cc83900b1fe3fe149efef98' "$workflow" || fail "fetch-metadata not pinned"
grep -q '3d3c42e5aac5ba805825da76410c181273ba90b1' "$workflow" || fail "checkout not pinned"
# shellcheck disable=SC2016 # workflow 式は展開せず、文字列として探す
grep -q 'ref: ${{ github.sha }}' "$workflow" || fail "checkout must use base github.sha"
if grep -Eq 'ref:.*head' "$workflow"; then
  fail "checkout ref must not follow the PR head"
fi
if grep -Eq -- '--auto|--admin' "$workflow" "$script"; then
  fail "auto-merge or admin bypass is not allowed"
fi
grep -q 'version-update:semver-patch' "$workflow" || fail "patch not eligible"
grep -q 'version-update:semver-minor' "$workflow" || fail "minor not eligible"
if grep -q 'version-update:semver-major' "$workflow"; then
  fail "major must not be listed as eligible"
fi
grep -F -q -- '--squash --match-head-commit' "$script" || fail "merge command drifted"

echo "ok"

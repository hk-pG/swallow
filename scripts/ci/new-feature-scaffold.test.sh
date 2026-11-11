#!/usr/bin/env bash
# scripts/agent/new-feature.sh が境界・契約 CI と Biome を満たすことを検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
scaffold="$root/scripts/agent/new-feature.sh"

pid=$$
NAME_DEFAULT="scaffold-ci-default-${pid}"
NAME_FULL="scaffold-ci-full-${pid}"
NAME_DRY="scaffold-ci-dry-${pid}"
NAME_API="scaffold-ci-api-${pid}"
NAME_SIDEBAR="scaffold-ci-sidebar-${pid}"

feature_dir() {
  printf '%s/apps/desktop/src/features/%s' "$root" "$1"
}

FEATURE_PATHS=(
  "$(feature_dir "$NAME_DEFAULT")"
  "$(feature_dir "$NAME_FULL")"
  "$(feature_dir "$NAME_DRY")"
  "$(feature_dir "$NAME_API")"
  "$(feature_dir "$NAME_SIDEBAR")"
)

cleanup() {
  local p
  for p in "${FEATURE_PATHS[@]}"; do
    rm -rf "$p"
  done
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -x "$scaffold" ]] || chmod +x "$scaffold"

expect_fail() {
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then
    fail "$label should have failed"
  fi
}

expect_fail "invalid PascalCase name" bash "$scaffold" BadName
expect_fail "reserved shared" bash "$scaffold" shared
expect_fail "reserved app" bash "$scaffold" app
expect_fail "reserved platform" bash "$scaffold" platform
expect_fail "empty name" bash "$scaffold" ""
expect_fail "duplicate tags" bash "$scaffold" tags

DRY_DIR="$(feature_dir "$NAME_DRY")"
bash "$scaffold" --dry-run "$NAME_DRY" >/dev/null || fail "dry-run exit code"
[[ ! -e "$DRY_DIR" ]] || fail "dry-run must not create feature directory"

bash "$scaffold" "$NAME_DEFAULT" >/dev/null || fail "default scaffold"
bash "$scaffold" "$NAME_API" --with-api >/dev/null || fail "with-api scaffold"
bash "$scaffold" "$NAME_SIDEBAR" --with-sidebar >/dev/null || fail "with-sidebar scaffold"
bash "$scaffold" "$NAME_FULL" --with-api --with-sidebar >/dev/null || fail "full scaffold"

[[ -f "$(feature_dir "$NAME_API")/api.ts" ]] || fail "api.ts missing for --with-api"
[[ ! -f "$(feature_dir "$NAME_DEFAULT")/api.ts" ]] || fail "api.ts must not exist for default scaffold"

sidebar_only=$(find "$(feature_dir "$NAME_SIDEBAR")/sidebar" -maxdepth 1 -name '*Section.tsx' -print -quit)
[[ -n "$sidebar_only" ]] || fail "sidebar section missing for --with-sidebar"

FEATURE_FULL="$(feature_dir "$NAME_FULL")"
sidebar_tsx=$(find "$FEATURE_FULL/sidebar" -maxdepth 1 -name '*Section.tsx' -print -quit)
[[ -n "$sidebar_tsx" ]] || fail "sidebar section not created for full scaffold"

for rel in \
  "apps/desktop/src/features/$NAME_DEFAULT/index.ts" \
  "apps/desktop/src/features/$NAME_API/index.ts" \
  "apps/desktop/src/features/$NAME_API/api.ts" \
  "apps/desktop/src/features/$NAME_SIDEBAR/index.ts" \
  "apps/desktop/src/features/$NAME_FULL/index.ts" \
  "apps/desktop/src/features/$NAME_FULL/api.ts" \
  "$sidebar_only" \
  "$sidebar_tsx"
do
  if [[ "$rel" == /* ]]; then
    rel="${rel#"$root/"}"
  fi
  pnpm exec biome check "$rel" >/dev/null || fail "biome: $rel"
done

if ! grep -q "other features' internal paths" "apps/desktop/src/features/$NAME_DEFAULT/index.ts"; then
  fail "default index.ts comment wording"
fi
if ! grep -q "other features' internal paths" "apps/desktop/src/features/$NAME_SIDEBAR/index.ts"; then
  fail "sidebar index.ts comment wording"
fi

node scripts/ci/feature-boundaries.mjs
node scripts/ci/tauri-command-contract.mjs
node scripts/ci/rust-module-boundaries.mjs
node scripts/ci/http-api-contract.mjs

pnpm typecheck >/dev/null || fail "pnpm typecheck with scaffolded features"

echo "ok"

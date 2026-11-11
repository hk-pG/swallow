#!/usr/bin/env bash
# scripts/agent/new-feature.sh が境界・契約 CI と Biome を満たすことを検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
scaffold="$root/scripts/agent/new-feature.sh"

NAME_DEFAULT="scaffold-ci-default-$$"
NAME_FULL="scaffold-ci-full-$$"
FEATURE_DEFAULT="$root/apps/desktop/src/features/$NAME_DEFAULT"
FEATURE_FULL="$root/apps/desktop/src/features/$NAME_FULL"

cleanup() {
  rm -rf "$FEATURE_DEFAULT" "$FEATURE_FULL"
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
expect_fail "empty name" bash "$scaffold" ""
expect_fail "duplicate tags" bash "$scaffold" tags

bash "$scaffold" "$NAME_DEFAULT" >/dev/null || fail "default scaffold"
bash "$scaffold" "$NAME_FULL" --with-api --with-sidebar >/dev/null || fail "full scaffold"

sidebar_tsx=$(find "$FEATURE_FULL/sidebar" -maxdepth 1 -name '*Section.tsx' -print -quit)
[[ -n "$sidebar_tsx" ]] || fail "sidebar section not created"

for rel in \
  "apps/desktop/src/features/$NAME_DEFAULT/index.ts" \
  "apps/desktop/src/features/$NAME_FULL/index.ts" \
  "apps/desktop/src/features/$NAME_FULL/api.ts" \
  "$sidebar_tsx"
do
  if [[ "$rel" == /* ]]; then
    rel="${rel#"$root/"}"
  fi
  pnpm exec biome check "$rel" >/dev/null || fail "biome: $rel"
done

node scripts/ci/feature-boundaries.mjs
node scripts/ci/tauri-command-contract.mjs
node scripts/ci/rust-module-boundaries.mjs
node scripts/ci/http-api-contract.mjs

echo "ok"

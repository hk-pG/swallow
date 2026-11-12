#!/usr/bin/env bash
# Reproducible perf run: generates fixed-seed libraries, runs Rust + frontend benches.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/agent/repos/swallow/scripts/agent/lib.sh
source "$ROOT/scripts/agent/lib.sh"
prepend_toolchain_path

PERF_DIR="$ROOT/scripts/perf"
DATA_DIR="$PERF_DIR/.data"
RESULTS_DIR="${PERF_RESULTS_DIR:-$PERF_DIR/results}"
SEED="${PERF_SEED:-42}"
LIST_RUNS="${PERF_LIST_RUNS:-7}"
IMPORT_COUNT="${PERF_IMPORT_COUNT:-50}"
IMPORT_RUNS="${PERF_IMPORT_RUNS:-5}"
FRONTEND_RUNS="${PERF_FRONTEND_RUNS:-5}"
COUNTS="${PERF_COUNTS:-10000 50000}"

mkdir -p "$DATA_DIR" "$RESULTS_DIR"

SWALLOW_PERF="$ROOT/target/release/swallow_perf"
if [[ ! -x "$SWALLOW_PERF" ]]; then
  info "building swallow_perf (release)"
  (cd "$ROOT/apps/desktop/src-tauri" && cargo build --release --features perf-bin --bin swallow_perf)
fi

ENV_JSON="$RESULTS_DIR/environment.json"
node "$PERF_DIR/lib/collect-env.mjs" "$ROOT" "$ENV_JSON"

MANIFEST="$RESULTS_DIR/manifest.json"
echo "{" >"$MANIFEST"
echo "  \"seed\": $SEED," >>"$MANIFEST"
echo "  \"counts\": [$(echo "$COUNTS" | sed 's/ /, /g')]," >>"$MANIFEST"
echo "  \"libraries\": {" >>"$MANIFEST"

first_lib=1
for COUNT in $COUNTS; do
  LIB="$DATA_DIR/library-${COUNT}"
  info "generating library ($COUNT items, seed=$SEED)"
  "$SWALLOW_PERF" generate --count "$COUNT" --seed "$SEED" --out "$LIB" 2>&1 | tail -1

  ITEMS_JSON="$DATA_DIR/items-${COUNT}.json"
  "$SWALLOW_PERF" export-json --library "$LIB" --out "$ITEMS_JSON" 2>&1 | tail -1

  LIST_JSON="$RESULTS_DIR/rust-list-${COUNT}.json"
  "$SWALLOW_PERF" bench list --library "$LIB" --runs "$LIST_RUNS" >"$LIST_JSON"

  IMPORT_JSON="$RESULTS_DIR/rust-import-${COUNT}.json"
  START_INDEX=$((COUNT + 1000000))
  "$SWALLOW_PERF" bench import --library "$LIB" --count "$IMPORT_COUNT" --seed "$SEED" \
    --runs "$IMPORT_RUNS" --start-index "$START_INDEX" >"$IMPORT_JSON"

  FRONT_JSON="$RESULTS_DIR/frontend-${COUNT}.json"
  (cd "$ROOT/apps/desktop" && pnpm exec tsx "perf/frontend-bench.mts" "$ITEMS_JSON" "$FRONT_JSON" "$FRONTEND_RUNS")


  if [[ $first_lib -eq 0 ]]; then
    echo "," >>"$MANIFEST"
  fi
  first_lib=0
  cat >>"$MANIFEST" <<EOF
    "$COUNT": {
      "libraryPath": "$LIB",
      "itemsJson": "$ITEMS_JSON",
      "rustList": "$LIST_JSON",
      "rustImport": "$IMPORT_JSON",
      "frontend": "$FRONT_JSON"
    }
EOF
done

echo "" >>"$MANIFEST"
echo "  }" >>"$MANIFEST"
echo "}" >>"$MANIFEST"

info "results in $RESULTS_DIR"

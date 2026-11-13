#!/usr/bin/env bash
# cargo-default-run.mjs が desktop crate の default-run を検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
node "$root/scripts/ci/cargo-default-run.mjs"

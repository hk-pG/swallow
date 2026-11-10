#!/usr/bin/env bash
# tauri-command-contract.mjs のパーサと本番ツリーの整合を検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
checker="$root/scripts/ci/tauri-command-contract.mjs"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import {
    rustCommandNames,
    tsInvokeCommandNames,
    diffCommandSets,
    findTauriApiBoundaryViolations,
  } from './scripts/ci/tauri-command-contract.mjs';

  const mod = readFileSync('apps/desktop/src-tauri/src/commands/mod.rs', 'utf8');
  const rust = rustCommandNames(mod);
  if (rust.length < 30) fail('expected many Rust commands');
  if (!rust.includes('list_items') || !rust.includes('app_info')) {
    throw new Error('missing known commands in parse');
  }

  const fakeApi = [
    'invoke(\"list_items\", {})',
    'invoke<ItemMetadata[]>(\"get_item\", {})',
  ];
  const ts = tsInvokeCommandNames(fakeApi);
  if (ts.join(',') !== 'get_item,list_items') {
    throw new Error('invoke parse: ' + ts.join(','));
  }

  const drift = diffCommandSets(['a', 'b'], ['b', 'c']);
  if (drift.onlyRust.join(',') !== 'a' || drift.onlyTs.join(',') !== 'c') {
    throw new Error('diffCommandSets');
  }

  const violations = findTauriApiBoundaryViolations('apps/desktop/src/features');
  if (violations.length !== 0) {
    throw new Error('unexpected boundary violations: ' + violations.join('; '));
  }
"

node "$checker" || fail "contract check on main tree"

echo "ok"

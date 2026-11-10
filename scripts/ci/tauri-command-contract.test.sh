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
    stripComments,
    findTauriApiBoundaryViolationsUnderDesktopSrc,
  } from './scripts/ci/tauri-command-contract.mjs';

  const mod = readFileSync('apps/desktop/src-tauri/src/commands/mod.rs', 'utf8');
  const rust = rustCommandNames(mod);
  if (rust.length < 30) {
    throw new Error('expected many Rust commands');
  }
  if (!rust.includes('list_items') || !rust.includes('app_info')) {
    throw new Error('missing known commands in parse');
  }

  const handlerNoTrailingComma = \`
    tauri::generate_handler![
      \$crate::commands::items::list_items,
      \$crate::commands::items::get_item
    ]
  \`;
  const fromNoComma = rustCommandNames(handlerNoTrailingComma);
  if (fromNoComma.join(',') !== 'get_item,list_items') {
    throw new Error('trailing comma omit: ' + fromNoComma.join(','));
  }

  const handlerCommented = \`
    tauri::generate_handler![
      \$crate::commands::items::list_items,
      // \$crate::commands::items::commented_out_cmd,
      \$crate::commands::app::app_info,
    ]
  \`;
  const fromCommented = rustCommandNames(handlerCommented);
  if (fromCommented.includes('commented_out_cmd')) {
    throw new Error('commented handler must not be parsed');
  }
  if (!fromCommented.includes('app_info') || !fromCommented.includes('list_items')) {
    throw new Error('commented handler parse lost real commands: ' + fromCommented.join(','));
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

  const commentedInvoke = stripComments(\`
    import { convertFileSrc } from \"@tauri-apps/api/core\";
    // invoke(\"bad\", {})
  \`);
  if (/\\binvoke\\b/.test(commentedInvoke)) {
    throw new Error('stripComments should remove commented invoke');
  }

  const violations = findTauriApiBoundaryViolationsUnderDesktopSrc();
  if (violations.length !== 0) {
    throw new Error('unexpected boundary violations: ' + violations.join('; '));
  }
"

node "$checker" || fail "contract check on main tree"

echo "ok"

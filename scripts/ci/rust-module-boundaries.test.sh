#!/usr/bin/env bash
# rust-module-boundaries.mjs のパーサと本番ツリーの整合を検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
checker="$root/scripts/ci/rust-module-boundaries.mjs"
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

node --input-type=module -e "
  import { mkdirSync, writeFileSync } from 'node:fs';
  import path from 'node:path';
  import {
    stripComments,
    stripStringLiterals,
    prepareSource,
    expandUseClause,
    extractUseRoots,
    resolveUsePath,
    checkUseViolation,
    checkLibRsFacade,
    findCratePathViolations,
    findRustBoundaryViolations,
    modulePathFromFile,
  } from './scripts/ci/rust-module-boundaries.mjs';

  const commented = prepareSource(\`
    use crate::domain::library;
    // use crate::commands::error::CommandError;
    /* use tauri::Manager; */
    let msg = \"crate::commands fake\";
  \`);
  const roots = extractUseRoots(commented);
  if (roots.join(',') !== 'crate::domain::library') {
    throw new Error('comments/strings ignored: ' + roots.join(','));
  }

  const domainMod = modulePathFromFile('domain/mod.rs');
  const domainFoo = modulePathFromFile('domain/foo.rs');
  const domainItemMod = modulePathFromFile('domain/item/mod.rs');

  if (checkUseViolation('domain', domainMod, 'super::infra::http_api') === null) {
    throw new Error('domain/mod.rs super::infra should fail');
  }
  if (checkUseViolation('domain', domainFoo, 'crate::infra::thumbnail') === null) {
    throw new Error('domain/foo crate::infra should fail');
  }
  if (checkUseViolation('domain', domainFoo, 'tauri::Manager') === null) {
    throw new Error('domain tauri should fail');
  }
  if (checkUseViolation('domain', domainFoo, 'axum::Router') === null) {
    throw new Error('domain axum should fail');
  }
  if (checkUseViolation('domain', domainFoo, 'crate::commands::error') === null) {
    throw new Error('domain commands should fail');
  }
  if (checkUseViolation('domain', domainFoo, 'crate::app::state') === null) {
    throw new Error('domain app should fail');
  }

  if (checkUseViolation('infra', ['infra', 'http_api'], 'crate::commands::app') === null) {
    throw new Error('infra commands should fail');
  }
  if (checkUseViolation('infra', ['infra', 'http_api'], 'crate::app::run') === null) {
    throw new Error('infra app::run should fail');
  }

  if (checkUseViolation('commands', ['commands', 'library'], 'crate::app::run') === null) {
    throw new Error('commands app::run should fail');
  }

  if (checkUseViolation('commands', ['commands', 'library'], 'crate::domain::library') !== null) {
    throw new Error('commands->domain should pass');
  }
  if (checkUseViolation('commands', ['commands', 'settings'], 'crate::infra::app_info') !== null) {
    throw new Error('commands->infra should pass');
  }
  if (checkUseViolation('commands', ['commands', 'library'], 'crate::app::state::AppState') !== null) {
    throw new Error('commands->app::state should pass');
  }
  if (checkUseViolation('commands', ['commands', 'settings'], 'tauri::Manager') !== null) {
    throw new Error('commands tauri should pass');
  }
  if (checkUseViolation('infra', ['infra', 'protocol'], 'crate::domain::item') !== null) {
    throw new Error('infra->domain should pass');
  }
  if (checkUseViolation('infra', ['infra', 'http_api'], 'axum::Router') !== null) {
    throw new Error('infra axum should pass');
  }
  if (checkUseViolation('domain', domainItemMod, 'super::library') !== null) {
    throw new Error('domain item super::library should pass');
  }
  if (checkUseViolation('domain', domainFoo, 'crate::domain::tags') !== null) {
    throw new Error('domain crate::domain should pass');
  }

  const resolved = resolveUsePath(domainMod, 'super::infra::x');
  if (resolved?.join('::') !== 'crate::infra::x') {
    throw new Error('resolve super::infra from domain/mod.rs: ' + resolved);
  }

  const rustSrc = path.join('$tmpdir', 'src');
  const write = (rel, body) => {
    const full = path.join(rustSrc, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body);
  };

  write('domain/mod.rs', 'use super::infra::http_api;\\n');
  write('domain/bad.rs', 'use crate::commands::error::CommandError;\\n');
  write('infra/bad.rs', 'use crate::commands::app::AppInfo;\\n');
  write('commands/bad.rs', 'use crate::app::run;\\n');
  write('commands/ok.rs', 'use crate::domain::library;\\nuse tauri::Manager;\\n');
  write('infra/ok.rs', 'use crate::domain::import;\\nuse axum::Router;\\n');

  const violations = findRustBoundaryViolations({ rustSrc });
  const keys = new Set(violations.map((v) => v.file));
  for (const need of ['domain/mod.rs', 'domain/bad.rs', 'infra/bad.rs', 'commands/bad.rs']) {
    if (!keys.has(need)) throw new Error('missing violation ' + need);
  }
  if (keys.has('commands/ok.rs') || keys.has('infra/ok.rs')) {
    throw new Error('false positive on ok fixtures');
  }

  const pathHits = findCratePathViolations('domain', domainFoo, 'fn x() { let _ = crate::infra::thumb; }');
  if (!pathHits.includes('crate::infra')) throw new Error('inline crate path');

  const grouped = expandUseClause('crate::{commands::error::CommandError, domain::item}');
  const groupedSet = new Set(grouped);
  if (
    !groupedSet.has('crate::commands::error::CommandError') ||
    !groupedSet.has('crate::domain::item')
  ) {
    throw new Error('grouped use: ' + grouped.join(','));
  }
  if (checkUseViolation('domain', domainFoo, 'crate::commands::error::CommandError') === null) {
    throw new Error('grouped commands path should fail domain');
  }

  const aliasRoots = extractUseRoots('use crate::commands as cmd;');
  if (aliasRoots.join(',') !== 'crate::commands') {
    throw new Error('use as alias: ' + aliasRoots.join(','));
  }
  if (checkUseViolation('infra', ['infra', 'http_api'], 'crate::commands') === null) {
    throw new Error('alias-resolved commands path should fail infra');
  }

  const rawSrc = prepareSource(\`
    use crate::domain::library;
    let doc = r#\" mention crate::commands here \"#\";
  \`);
  if (extractUseRoots(rawSrc).join(',') !== 'crate::domain::library') {
    throw new Error('raw string should not add use roots');
  }
  const rawPath = findCratePathViolations(
    'domain',
    domainFoo,
    \`let s = r#\" crate::commands::x \"#\";\`,
  );
  if (rawPath.length > 0) throw new Error('raw string inline path false positive');

  if (checkLibRsFacade('#[tauri::command]\\npub fn evil() {}').length === 0) {
    throw new Error('lib.rs tauri command should fail facade check');
  }

  write('lib.rs', 'mod app;\\n#[tauri::command]\\nfn bad() {}\\n');
  const libViolations = findRustBoundaryViolations({ rustSrc });
  if (!libViolations.some((v) => v.file === 'lib.rs' && v.rule === 'facade')) {
    throw new Error('lib.rs integration facade violation');
  }
"

node "$checker" || fail "boundary check on main tree"

echo "ok"

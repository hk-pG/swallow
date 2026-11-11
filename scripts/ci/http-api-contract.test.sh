#!/usr/bin/env bash
# http-api-contract.mjs のパーサと本番ツリーの整合を検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import {
    parseSharedHttpRoutes,
    parseRustHttpRoutes,
    diffHttpRoutes,
    stripComments,
    routeKey,
    collectSharedExportedTypeNames,
    findMissingRouteTypes,
    findRustHandlerMismatches,
    findHttpApiContractTypeDrift,
    findExtensionApiLiteralViolations,
    findExtensionRawApiPathLiterals,
    extensionSourceDirectoryError,
  } from './scripts/ci/http-api-contract.mjs';

  const contract = readFileSync('packages/shared/src/api/httpContract.ts', 'utf8');
  const shared = parseSharedHttpRoutes(contract);
  if (shared.length !== 2) throw new Error('expected 2 shared routes, got ' + shared.length);
  if (!shared.some((r) => r.id === 'appInfo' && r.method === 'GET')) {
    throw new Error('missing appInfo route');
  }

  const rustSrc = readFileSync('apps/desktop/src-tauri/src/infra/http_api.rs', 'utf8');
  const rust = parseRustHttpRoutes(rustSrc);
  if (rust.length !== 2) throw new Error('expected 2 rust routes, got ' + rust.length);

  const drift = diffHttpRoutes(shared, rust);
  if (drift.onlyShared.length || drift.onlyRust.length) {
    throw new Error('production tree drift: ' + JSON.stringify(drift));
  }

  const driftMethod = parseSharedHttpRoutes(\`
    export const HTTP_API_ROUTES = [
      { id: \"x\", method: \"POST\", path: \"/api/app/info\", requestType: null, responseType: \"AppInfo\" },
    ] as const;
  \`);
  const baseRust = [{ method: 'GET', path: '/api/app/info', requestType: null, responseType: 'AppInfo' }];
  const methodDiff = diffHttpRoutes(driftMethod, baseRust);
  if (methodDiff.onlyShared.join(',') !== 'POST /api/app/info' || methodDiff.onlyRust.join(',') !== 'GET /api/app/info') {
    throw new Error('method diff detection failed');
  }

  const urlSafe = stripComments('fetch(\"http://127.0.0.1:41600/api/items\")');
  if (!urlSafe.includes('/api/items')) throw new Error('stripComments must preserve URL schemes');

  const commented = stripComments(\`
    // { id: \"ghost\", method: \"GET\", path: \"/api/nope\", requestType: null, responseType: \"AppInfo\" }
    { id: \"appInfo\", method: \"GET\", path: \"/api/app/info\", requestType: null, responseType: \"AppInfo\" }
  \`);
  const fromComment = parseSharedHttpRoutes(commented);
  if (fromComment.length !== 1 || fromComment[0].id !== 'appInfo') {
    throw new Error('comment strip for shared routes');
  }

  const exported = collectSharedExportedTypeNames('packages/shared/src');
  const missing = findMissingRouteTypes(shared, exported);
  if (missing.length) throw new Error('missing types in prod tree: ' + missing.join(', '));

  const fakeRustMissing = findRustHandlerMismatches(
    [{ id: 'x', method: 'GET', path: '/api/x', requestType: null, responseType: 'NotHere' }],
    'fn x() {}',
  );
  if (fakeRustMissing.length < 2) throw new Error('rust handler mismatch detection');

  const substringFalsePass = findRustHandlerMismatches(
    [{ id: 'appInfo', method: 'GET', path: '/api/app/info', requestType: null, responseType: 'AppInfo' }],
    'struct FakeAppInfo {}\nfn x() { let _ = FakeAppInfo; }',
  );
  if (substringFalsePass.length === 0) throw new Error('word boundary must reject FakeAppInfo');

  const dispatchMissing = findRustHandlerMismatches(
    [{ id: 'appInfo', method: 'GET', path: '/api/app/info', requestType: null, responseType: 'AppInfo' }],
    'use crate::domain::item::ItemMetadata;\nstruct AppInfo;',
  );
  if (!dispatchMissing.some((m) => m.includes('dispatch'))) throw new Error('dispatch arm check');

  const contractIssues = findHttpApiContractTypeDrift(shared, contract);
  if (contractIssues.length) throw new Error('prod contract drift: ' + contractIssues.join(', '));

  const manualSource = \`
    export const HTTP_API_ROUTES = [
      { id: \"appInfo\", method: \"GET\", path: \"/api/app/info\", requestType: null, responseType: \"AppInfo\" },
    ] as const;
    export type HttpApiRouteId = \"appInfo\" | \"orphan\";
    export type HttpApiContractMap = {
      appInfo: { method: \"GET\"; path: \"/api/app/info\"; request: undefined; response: unknown };
      orphan: { method: \"GET\"; path: \"/api/nope\"; request: undefined; response: unknown };
    };
  \`;
  const manualRoutes = parseSharedHttpRoutes(manualSource);
  const manualMap = findHttpApiContractTypeDrift(manualRoutes, manualSource);
  if (!manualMap.some((m) => m.includes('must be derived'))) throw new Error('derived map enforcement');
  if (!manualMap.some((m) => m.includes('unknown route id'))) throw new Error('manual map key drift');

  const allowed = new Set(shared.map((r) => r.path));
  const extDir = 'apps/extension/src';
  if (extensionSourceDirectoryError(extDir)) throw new Error('apps/extension/src must exist');
  if (extensionSourceDirectoryError('apps/extension/src-missing') === null) {
    throw new Error('missing extension source must be reported');
  }
  const unknown = findExtensionApiLiteralViolations(extDir, allowed);
  if (unknown.length) throw new Error('unexpected extension unknown paths on prod tree');

  console.log('unit checks ok');
" 2>&1 || fail "inline unit tests"

# Production tree must pass the checker without violations.
if ! node scripts/ci/http-api-contract.mjs; then
  fail "http-api-contract.mjs failed on repository tree"
fi

# Synthetic extension raw-literal detection (in-memory via node).
node --input-type=module -e "
  import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
  import { join } from 'node:path';
  import {
    findExtensionRawApiPathLiterals,
    findExtensionApiLiteralViolations,
  } from './scripts/ci/http-api-contract.mjs';

  const tmp = join('scripts/ci', '.http-api-contract-fixture');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, 'nested'), { recursive: true });
  writeFileSync(
    join(tmp, 'bad.ts'),
    'fetch(\"http://127.0.0.1:41600/api/items?name=x\")',
  );
  const raw = findExtensionRawApiPathLiterals(tmp);
  if (raw.length !== 1) throw new Error('expected raw literal violation');

  writeFileSync(
    join(tmp, 'nested', 'good.ts'),
    'import { API_PATHS } from \"@swallow/shared\"; fetch(API_PATHS.addItem)',
  );
  const rawGood = findExtensionRawApiPathLiterals(tmp);
  if (rawGood.length !== 1 || !rawGood[0].file.endsWith('bad.ts')) {
    throw new Error('shared API_PATHS usage should not add violations');
  }

  writeFileSync(
    join(tmp, 'nested', 'better.ts'),
    'import { addItemPath } from \"@swallow/shared\"; fetch(addItemPath({}))',
  );
  const rawBetter = findExtensionRawApiPathLiterals(tmp);
  if (rawBetter.length !== 1) throw new Error('expected only bad.ts');

  const allowed = new Set(['/api/items', '/api/app/info']);
  const unknown = findExtensionApiLiteralViolations(tmp, allowed);
  if (unknown.length) throw new Error('unknown path false positive');

  writeFileSync(join(tmp, 'unknown.ts'), 'fetch(\"/api/nope\")');
  const unknown2 = findExtensionApiLiteralViolations(tmp, allowed);
  if (unknown2.length !== 1) throw new Error('unknown path must be detected');

  rmSync(tmp, { recursive: true, force: true });
"

echo "http-api-contract.test.sh ok"

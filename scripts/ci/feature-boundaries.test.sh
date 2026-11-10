#!/usr/bin/env bash
# feature-boundaries.mjs のパーサと本番ツリーの整合を検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
checker="$root/scripts/ci/feature-boundaries.mjs"
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
    extractModuleSpecifiers,
    resolveSpecifier,
    checkLayerViolation,
    checkFacadeViolation,
    findBoundaryViolations,
    isPublicFeatureEntry,
  } from './scripts/ci/feature-boundaries.mjs';

  const commented = stripComments(\`
    import { x } from './a';
    // import { bad } from '../features/items/components/X';
    /* import { also } from '../app/foo'; */
  \`);
  const specs = extractModuleSpecifiers(commented);
  if (specs.join(',') !== './a') {
    throw new Error('comments ignored: ' + specs.join(','));
  }

  if (!isPublicFeatureEntry('features/items')) throw new Error('items root');
  if (!isPublicFeatureEntry('features/items/index')) throw new Error('items index');
  if (!isPublicFeatureEntry('features/items/api')) throw new Error('items api');
  if (isPublicFeatureEntry('features/items/lib/selection')) throw new Error('deep should fail');

  if (checkLayerViolation('platform', 'features') !== 'platform must not import from features or app') {
    throw new Error('platform layer');
  }
  if (checkLayerViolation('shared', 'app') !== 'shared must not import from features or app') {
    throw new Error('shared layer');
  }
  if (checkLayerViolation('features', 'app') !== 'features must not import from app') {
    throw new Error('features layer');
  }
  if (checkLayerViolation('features', 'platform') !== null) {
    throw new Error('features->platform should be allowed');
  }

  const facade = checkFacadeViolation(
    'features/trash/hooks/useTrashActions.ts',
    'features/items/lib/selection',
  );
  if (!facade || !facade.includes('features/items')) {
    throw new Error('facade violation expected');
  }
  if (checkFacadeViolation('features/items/hooks/x.ts', 'features/items/lib/y.ts') !== null) {
    throw new Error('same feature should be allowed');
  }
  if (checkFacadeViolation('app/useAppSession.ts', 'features/items/index') !== null) {
    throw new Error('public facade import allowed');
  }

  const desktopSrc = path.join('$tmpdir', 'src');
  const write = (rel, body) => {
    const full = path.join(desktopSrc, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body);
  };

  write('features/items/index.ts', 'export {}');
  write('features/items/api.ts', 'export {}');
  write('features/items/lib/selection.ts', 'export const s = 1');
  write('features/trash/hooks/bad.ts', \"import { s } from '../../items/lib/selection';\");
  write('features/trash/hooks/ok-api.ts', \"import {} from '../../items/api';\");
  write('features/trash/hooks/ok-index.ts', \"import {} from '../../items';\");
  write('app/deep.ts', \"import {} from '../features/items/components/X';\");
  write('shared/ok.ts', 'export {}');
  write('platform/bad.ts', \"import {} from '../features/items';\");
  write('features/up/bad.ts', \"import {} from '../../app/foo';\");
  write('features/items/internal.ts', \"import {} from './lib/selection';\");
  write('features/up/rel.ts', \"import {} from '../../items';\");
  write('items-only/spec.ts', '// import in commented\\nimport { x } from \\\"./x\\\";');

  const violations = findBoundaryViolations({ desktopSrc });
  const rules = new Set(violations.map((v) => v.rule + ':' + v.file));
  const needFacade = [
    'facade:features/trash/hooks/bad.ts',
    'facade:app/deep.ts',
  ];
  for (const k of needFacade) {
    if (![...rules].some((r) => r === k)) throw new Error('missing ' + k);
  }
  const needLayer = [
    'layer:platform/bad.ts',
    'layer:features/up/bad.ts',
  ];
  for (const k of needLayer) {
    if (![...rules].some((r) => r === k)) throw new Error('missing ' + k);
  }
  const allowed = violations.filter((v) =>
    ['features/trash/hooks/ok-api.ts', 'features/trash/hooks/ok-index.ts', 'features/items/internal.ts', 'features/up/rel.ts'].includes(v.file),
  );
  if (allowed.length > 0) {
    throw new Error('false positives: ' + allowed.map((v) => v.file).join(', '));
  }

  const resolved = resolveSpecifier(
    path.join(desktopSrc, 'features/trash/hooks/x.ts'),
    '../../items/lib/selection',
    desktopSrc,
  );
  if (resolved !== 'features/items/lib/selection') {
    throw new Error('resolve: ' + resolved);
  }
"

node "$checker" || fail "boundary check on main tree"

echo "ok"

#!/usr/bin/env bash
# style-token-boundaries.mjs のパーサと本番ツリーの整合を検証する。
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
checker="$root/scripts/ci/style-token-boundaries.mjs"
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
    containsRawColorLiteral,
    isHardcodedVisualStyleValue,
    extractInlineStyleObjects,
    findInlineStyleViolations,
    findStyleTokenViolations,
  } from './scripts/ci/style-token-boundaries.mjs';

  if (containsRawColorLiteral('#abc')) {
    // ok
  } else {
    throw new Error('hex detect');
  }
  if (containsRawColorLiteral('rgb(1, 2, 3)')) {
    // ok
  } else {
    throw new Error('rgb detect');
  }
  if (containsRawColorLiteral('var(--color-tint)')) {
    throw new Error('var should not match');
  }

  const commented = stripComments(\`
    /* #deadbeef */
    // color: #ccc;
    gap: 8px;
  \`);
  if (containsRawColorLiteral(commented)) {
    throw new Error('comments should strip color literals');
  }

  if (!isHardcodedVisualStyleValue('fontSize', '14px')) {
    throw new Error('fontSize px');
  }
  if (isHardcodedVisualStyleValue('left', '12px')) {
    throw new Error('left should be layout');
  }
  if (isHardcodedVisualStyleValue('--item-thumb-size', '\`\${n}px\`')) {
    throw new Error('custom prop allowed');
  }
  if (isHardcodedVisualStyleValue('background', 'COLOR_LABEL_SWATCH[label]')) {
    throw new Error('member expr background');
  }
  if (!isHardcodedVisualStyleValue('background', \"'#ff0000'\")) {
    throw new Error('background hex string');
  }

  const inline = \`
    <div style={{ left: 1, top: 2, fontSize: 15 }} />
    <span style={{ '--swatch': x } as CSSProperties} />
  \`;
  const objects = extractInlineStyleObjects(inline);
  if (objects.length !== 2) throw new Error('inline objects: ' + objects.length);
  const inlineViolations = findInlineStyleViolations(inline);
  if (!inlineViolations.some((v) => v.prop === 'fontSize')) {
    throw new Error('fontSize violation expected');
  }

  const desktopSrc = path.join('$tmpdir', 'src');
  const write = (rel, body) => {
    const full = path.join(desktopSrc, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body);
  };

  write('styles/tokens.css', ':root { --x: #fff; }');
  write('styles/bad.css', '.x { color: #123456; }');
  write('styles/ok.css', '.y { color: var(--color-label); gap: 8px; }');
  write('features/items/Bad.tsx', 'export const X = () => <i style={{ color: \"#abc\" }} />;');
  write('features/items/Ok.tsx', 'export const Y = () => <i style={{ left: 0, top: 0 }} />;');
  write('app/App.tsx', 'export const Z = () => <main style={{ fontSize: 12 }} />;');

  const violations = findStyleTokenViolations({ desktopSrc });
  const keys = violations.map((v) => v.rule + ':' + v.file);
  for (const need of ['css-color-literal:styles/bad.css', 'tsx-color-literal:features/items/Bad.tsx', 'tsx-inline-style:app/App.tsx']) {
    if (!keys.some((k) => k === need)) throw new Error('missing ' + need);
  }
  if (keys.some((k) => k.endsWith('features/items/Ok.tsx') || k.endsWith('styles/ok.css'))) {
    throw new Error('false positive: ' + keys.join(', '));
  }
"

node "$checker" || fail "style token check on main tree"

echo "ok"

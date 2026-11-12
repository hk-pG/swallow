#!/usr/bin/env bash
# Optional Chromium headless synthetic DOM (not React/Tauri). Off by default in run-all (see perf.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/scripts/perf/results/browser-headless.json}"
COUNT="${2:-10000}"

if [[ "$COUNT" -gt 5000 ]]; then
  cat >"$OUT" <<EOF
{"status":"not_checked","itemCount":$COUNT,"reason":"headless chrome は ${COUNT} ノードで dump-dom がハングするためスキップ（Cloud 実測未完了）"}
EOF
  exit 0
fi

CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    CHROME="$(command -v "$c")"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  echo '{"status":"not_checked","reason":"chrome binary not found"}' >"$OUT"
  exit 0
fi

HTML="$ROOT/scripts/perf/.build/bench.html"
mkdir -p "$(dirname "$HTML")"
cat >"$HTML" <<EOF
<!DOCTYPE html><html><body>
<script>
const n = $COUNT;
const t0 = performance.now();
const root = document.createElement('div');
root.style.cssText = 'display:grid;grid-template-columns:repeat(6,120px);gap:8px;height:480px;overflow:auto';
for (let i = 0; i < n; i++) {
  const el = document.createElement('div');
  el.textContent = 'asset-' + String(i).padStart(5,'0');
  el.style.height = '120px';
  root.appendChild(el);
}
document.body.appendChild(root);
const t1 = performance.now();
const scroll0 = performance.now();
for (let s = 0; s < 25; s++) root.scrollTop = (root.scrollHeight * s) / 25;
const t2 = performance.now();
document.title = JSON.stringify({layer:'chromium_headless_synthetic',itemCount:n,listRenderMs:t1-t0,scrollMs:t2-scroll0});
</script></body></html>
EOF

if ! timeout 45s "$CHROME" --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --dump-dom "file://$HTML" >/tmp/chrome-dump.html 2>/dev/null; then
  echo '{"status":"not_checked","reason":"headless chrome timed out or failed"}' >"$OUT"
  exit 0
fi

TITLE="$(grep -o '<title>[^<]*</title>' /tmp/chrome-dump.html | sed 's/<[/]title>//;s/<title>//')"
if [[ -z "$TITLE" ]]; then
  echo '{"status":"not_checked","reason":"headless chrome produced no title metrics"}' >"$OUT"
  exit 0
fi
echo "$TITLE" >"$OUT"

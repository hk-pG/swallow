#!/usr/bin/env node
/**
 * Guards against new bare `console.error`/`console.warn` and `eprintln!` in apps/desktop.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const desktopRoot = path.join(repoRoot, "apps/desktop");

const ALLOWLIST_SUFFIXES = [
  "apps/desktop/src-tauri/src/infra/http_api.rs",
  "apps/desktop/src-tauri/src/bin/swallow_perf.rs",
  "apps/desktop/perf/frontend-bench.mts",
];

const PATTERNS = [/\bconsole\.(?:error|warn)\s*\(/, /\beprintln!\s*\(/];

function isTestFile(rel) {
  return rel.includes(".test.") || rel.endsWith(".test.tsx") || rel.endsWith(".test.ts");
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules") {
        continue;
      }
      walk(full, out);
    } else if (/\.(?:tsx?|rs|mts)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const file of walk(desktopRoot)) {
  const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
  if (ALLOWLIST_SUFFIXES.some((suffix) => rel === suffix)) {
    continue;
  }
  if (isTestFile(rel)) {
    continue;
  }
  const source = readFileSync(file, "utf8");
  for (const pattern of PATTERNS) {
    if (pattern.test(source)) {
      violations.push(`${rel} (${pattern})`);
    }
  }
}

if (violations.length > 0) {
  console.error("Bare log sinks found in apps/desktop (use diagnostic log facade instead):\n");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("no-bare-log-sinks: ok");

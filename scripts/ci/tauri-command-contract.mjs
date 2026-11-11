#!/usr/bin/env node
/**
 * Keeps Tauri command names in sync between Rust and feature api.ts modules,
 * and restricts invoke and listen to those api modules.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const commandsMod = path.join(repoRoot, "apps/desktop/src-tauri/src/commands/mod.rs");
const desktopSrc = path.join(repoRoot, "apps/desktop/src");

const BOUNDARY_SCAN_DIRS = ["features", "app", "shared"];

/** Strips line and block comments (Rust and TS subset). */
export function stripComments(source) {
  const blockComment = /\/\*[\s\S]*?\*\//g;
  const lineComment = /\/\/[^\n\r]*/g;
  return source.replace(blockComment, "").replace(lineComment, "");
}

export function rustCommandNames(modSource) {
  const names = [];
  const handlerRe = /generate_handler!\[([\s\S]*?)\]/;
  const match = modSource.match(handlerRe);
  if (!match) {
    throw new Error("generate_handler! block not found in commands/mod.rs");
  }
  const body = stripComments(match[1]);
  const fnRe = /::(\w+)\s*(?:,|$)/gm;
  for (const segment of body.matchAll(fnRe)) {
    names.push(segment[1]);
  }
  return [...new Set(names)].sort();
}

export function tsInvokeCommandNames(apiSources) {
  const names = [];
  const invokeRe = /invoke(?:<[^>]*>)?\(\s*["'](\w+)["']/g;
  for (const source of apiSources) {
    for (const match of source.matchAll(invokeRe)) {
      names.push(match[1]);
    }
  }
  return [...new Set(names)].sort();
}

function listFilesRecursive(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFilesRecursive(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

export function readFeatureApiSources() {
  const apiFiles = listFilesRecursive(
    path.join(desktopSrc, "features"),
    (p) => p.endsWith("/api.ts") || p.endsWith(`${path.sep}api.ts`),
  );
  return apiFiles.map((file) => readFileSync(file, "utf8"));
}

export function diffCommandSets(rustNames, tsNames) {
  const rust = new Set(rustNames);
  const ts = new Set(tsNames);
  const onlyRust = rustNames.filter((n) => !ts.has(n));
  const onlyTs = tsNames.filter((n) => !rust.has(n));
  return { onlyRust, onlyTs };
}

function isExemptBoundaryFile(rel) {
  if (rel.endsWith("features/import/hooks/useAssetImport.ts")) {
    return true;
  }
  if (/\/features\/[^/]+\/api\.ts$/.test(rel)) {
    return true;
  }
  return false;
}

export function findTauriApiBoundaryViolations(scanDir) {
  const violations = [];
  const files = listFilesRecursive(
    scanDir,
    (p) =>
      (p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.endsWith(".test.ts") &&
      !p.endsWith(".test.tsx"),
  );
  for (const file of files) {
    const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
    if (isExemptBoundaryFile(rel)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    if (!source.includes("@tauri-apps/api/")) {
      continue;
    }
    const code = stripComments(source);
    if (/\binvoke\b/.test(code) || /\blisten\b/.test(code)) {
      violations.push(rel);
    }
  }
  return violations;
}

export function findTauriApiBoundaryViolationsUnderDesktopSrc() {
  const violations = [];
  for (const segment of BOUNDARY_SCAN_DIRS) {
    const dir = path.join(desktopSrc, segment);
    if (!existsSync(dir)) {
      continue;
    }
    violations.push(...findTauriApiBoundaryViolations(dir));
  }
  return violations;
}

function main() {
  const modSource = readFileSync(commandsMod, "utf8");
  const rustNames = rustCommandNames(modSource);
  const tsNames = tsInvokeCommandNames(readFeatureApiSources());
  const { onlyRust, onlyTs } = diffCommandSets(rustNames, tsNames);

  let failed = false;
  if (onlyRust.length > 0 || onlyTs.length > 0) {
    failed = true;
    console.error("Tauri command name mismatch between Rust and features/*/api.ts:");
    if (onlyRust.length > 0) {
      console.error(`  registered in Rust only: ${onlyRust.join(", ")}`);
    }
    if (onlyTs.length > 0) {
      console.error(`  invoked from TS only: ${onlyTs.join(", ")}`);
    }
  }

  const boundaryViolations = findTauriApiBoundaryViolationsUnderDesktopSrc();
  if (boundaryViolations.length > 0) {
    failed = true;
    console.error(
      "invoke/listen must stay in features/*/api.ts (useAssetImport webview is exempt):",
    );
    for (const file of boundaryViolations) {
      console.error(`  ${file}`);
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log(`ok (${rustNames.length} Tauri commands aligned, API boundary clean)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

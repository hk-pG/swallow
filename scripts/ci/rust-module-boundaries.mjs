#!/usr/bin/env node
/**
 * Enforces Rust backend layer boundaries (domain / commands / infra / lib facade).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rustSrc = path.join(repoRoot, "apps/desktop/src-tauri/src");

const SCAN_LAYERS = new Set(["domain", "commands", "infra", "app"]);

/** Strips line and block comments (Rust subset). */
export function stripComments(source) {
  const blockComment = /\/\*[\s\S]*?\*\//g;
  const lineComment = /\/\/[^\n\r]*/g;
  return source.replace(blockComment, "").replace(lineComment, "");
}

/** Removes string literals so error messages do not false-positive. */
export function stripStringLiterals(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "r") {
      const raw = /^r(#*)"/.exec(source.slice(i));
      if (raw) {
        const hashes = raw[1];
        const open = `r${hashes}"`;
        const close = `"${hashes}`;
        const start = i + open.length;
        const end = source.indexOf(close, start);
        if (end === -1) {
          out += " ";
          i += open.length;
          continue;
        }
        out += " ".repeat(end + close.length - i);
        i = end + close.length;
        continue;
      }
    }
    if (ch === '"') {
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      out += " ";
      continue;
    }
    if (ch === "'") {
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      out += " ";
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function prepareSource(source) {
  return stripStringLiterals(stripComments(source));
}

export function modulePathFromFile(relPosix) {
  if (relPosix === "lib.rs") return ["lib"];
  if (relPosix === "main.rs") return ["main"];
  let stem = relPosix.replace(/\.rs$/, "");
  if (stem.endsWith("/mod")) {
    stem = stem.slice(0, -4);
  }
  return stem.split("/");
}

export function layerFromFile(relPosix) {
  if (relPosix === "lib.rs") return "lib";
  if (relPosix === "main.rs") return "main";
  const [top] = relPosix.split("/");
  return top ?? "unknown";
}

/** Splits a `use` clause into root path strings (e.g. crate::domain::item). */
export function expandUseClause(clause) {
  const trimmed = clause.trim();
  if (!trimmed) return [];
  const brace = trimmed.indexOf("{");
  if (brace === -1) {
    return [normalizeUsePath(trimmed)];
  }
  const prefix = trimmed
    .slice(0, brace)
    .replace(/::{?\s*$/, "")
    .trim();
  if (!prefix) return [];
  return [normalizeUsePath(prefix)];
}

function normalizeUsePath(p) {
  return p.replace(/\s+/g, "").replace(/::$/, "");
}

export function extractUseRoots(source) {
  const code = prepareSource(source);
  const roots = [];
  const useRe = /\buse\s+([^;]+);/gs;
  for (const match of code.matchAll(useRe)) {
    for (const root of expandUseClause(match[1])) {
      if (root && root !== "self") {
        roots.push(root);
      }
    }
  }
  return roots;
}

export function pathSegments(pathStr) {
  return pathStr.split("::").filter(Boolean);
}

export function resolveUsePath(modulePath, pathStr) {
  const segments = pathSegments(pathStr);
  if (segments.length === 0) return null;
  if (segments[0] === "crate") {
    return segments;
  }
  if (segments[0] === "tauri" || segments[0] === "axum") {
    return segments;
  }
  const mp = [...modulePath];
  let i = 0;
  while (i < segments.length && segments[i] === "super") {
    mp.pop();
    i += 1;
  }
  if (i < segments.length && segments[i] === "crate") {
    return segments.slice(i);
  }
  if (i < segments.length && segments[i] === "self") {
    return ["crate", ...mp, ...segments.slice(i + 1)];
  }
  if (mp.length === 0) {
    return ["crate", ...segments.slice(i)];
  }
  const parent = mp.slice(0, -1);
  return ["crate", ...parent, ...segments.slice(i)];
}

function isAppRun(resolved) {
  return resolved[0] === "crate" && resolved[1] === "app" && resolved[2] === "run";
}

function crateSecond(resolved) {
  if (resolved[0] !== "crate" || resolved.length < 2) return null;
  return resolved[1];
}

export function checkUseViolation(layer, modulePath, usePath) {
  const resolved = resolveUsePath(modulePath, usePath);
  if (!resolved) return null;

  if (layer === "domain") {
    if (resolved[0] === "tauri" || resolved[0] === "axum") {
      return "domain must not depend on tauri or axum";
    }
    const second = crateSecond(resolved);
    if (second === "commands" || second === "infra" || second === "app") {
      return `domain must not depend on crate::${second}`;
    }
  }

  if (layer === "commands") {
    if (isAppRun(resolved)) {
      return "commands must not depend on crate::app::run";
    }
  }

  if (layer === "infra") {
    const second = crateSecond(resolved);
    if (second === "commands") {
      return "infra must not depend on crate::commands";
    }
    if (isAppRun(resolved)) {
      return "infra must not depend on crate::app::run";
    }
  }

  return null;
}

const CRATE_PATH_RE = /\bcrate::(commands|infra|app)(?:::|(?=[\s,;)}]))/g;

export function findCratePathViolations(layer, _modulePath, source) {
  if (layer !== "domain") return [];
  const code = prepareSource(source);
  const violations = [];
  for (const match of code.matchAll(CRATE_PATH_RE)) {
    const crateLayer = match[1];
    if (crateLayer === "app") {
      const tail = code.slice(match.index, match.index + 80);
      if (/crate::app::run\b/.test(tail)) {
        violations.push(`crate::app::run`);
      } else {
        violations.push(`crate::${crateLayer}`);
      }
    } else {
      violations.push(`crate::${crateLayer}`);
    }
  }
  return [...new Set(violations)];
}

export function checkLibRsFacade(source) {
  const violations = [];
  if (/#\[tauri::command\]/.test(prepareSource(source))) {
    violations.push("lib.rs must not define #[tauri::command]");
  }
  return violations;
}

function listRustFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listRustFiles(full));
    } else if (full.endsWith(".rs")) {
      out.push(full);
    }
  }
  return out;
}

export function findRustBoundaryViolations(options = {}) {
  const root = options.rustSrc ?? rustSrc;
  if (!existsSync(root)) {
    throw new Error(`Rust src not found: ${root}`);
  }
  const violations = [];
  for (const file of listRustFiles(root)) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const layer = layerFromFile(rel);
    if (!SCAN_LAYERS.has(layer) && layer !== "lib") {
      continue;
    }
    const source = readFileSync(file, "utf8");
    const modulePath = modulePathFromFile(rel);

    if (layer === "lib") {
      for (const msg of checkLibRsFacade(source)) {
        violations.push({ file: rel, path: "lib.rs", rule: "facade", message: msg });
      }
      continue;
    }

    for (const usePath of extractUseRoots(source)) {
      const msg = checkUseViolation(layer, modulePath, usePath);
      if (msg) {
        violations.push({ file: rel, path: usePath, rule: "use", message: msg });
      }
    }

    if (layer === "domain") {
      for (const cratePath of findCratePathViolations(layer, modulePath, source)) {
        violations.push({
          file: rel,
          path: cratePath,
          rule: "path",
          message: `domain must not reference ${cratePath}`,
        });
      }
    }
  }
  return violations;
}

export function formatViolations(violations) {
  return violations.map((v) => `${v.file}: ${v.path} (${v.rule}: ${v.message})`);
}

function main() {
  const violations = findRustBoundaryViolations();
  if (violations.length > 0) {
    console.error("Rust module boundary violations:");
    for (const line of formatViolations(violations)) {
      console.error(`  ${line}`);
    }
    process.exit(1);
  }
  console.log("ok (Rust layer boundaries clean)");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

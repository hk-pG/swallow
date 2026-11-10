#!/usr/bin/env node
/**
 * Keeps the desktop local HTTP API in sync between Rust, @swallow/shared, and the Chrome extension.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sharedApiDir = path.join(repoRoot, "packages/shared/src");
const httpContract = path.join(sharedApiDir, "api/httpContract.ts");
const httpApiRs = path.join(repoRoot, "apps/desktop/src-tauri/src/infra/http_api.rs");
const extensionSrc = path.join(repoRoot, "apps/extension/src");

/** Strips line and block comments (TS / Rust subset). */
export function stripComments(source) {
  const blockComment = /\/\*[\s\S]*?\*\//g;
  // Do not treat `://` in URLs as a line comment.
  const lineComment = /(^|[^:])\/\/[^\n\r]*/gm;
  return source.replace(blockComment, "").replace(lineComment, "$1");
}

/**
 * @returns {{ id: string, method: string, path: string, requestType: string | null, responseType: string }[]}
 */
export function parseSharedHttpRoutes(contractSource) {
  const code = stripComments(contractSource);
  const routes = [];
  const rowRe =
    /\{\s*id:\s*"([^"]+)",\s*method:\s*"([^"]+)",\s*path:\s*"([^"]+)",\s*requestType:\s*(null|"([^"]*)"),\s*responseType:\s*"([^"]+)"\s*,?\s*\}/gs;
  for (const match of code.matchAll(rowRe)) {
    routes.push({
      id: match[1],
      method: match[2],
      path: match[3],
      requestType: match[4] === "null" ? null : match[5],
      responseType: match[6],
    });
  }
  return routes;
}

/**
 * @returns {{ method: string, path: string, requestType: string | null, responseType: string }[]}
 */
export function parseRustHttpRoutes(rustSource) {
  const code = stripComments(rustSource);
  const blockRe = /const\s+HTTP_API_ROUTE_SPECS:\s*&\[HttpRouteSpec\]\s*=\s*&\[([\s\S]*?)\];/;
  const block = code.match(blockRe);
  if (!block) {
    throw new Error("HTTP_API_ROUTE_SPECS not found in infra/http_api.rs");
  }
  const routes = [];
  const rowRe =
    /HttpRouteSpec\s*\{\s*method:\s*"([^"]+)",\s*path:\s*"([^"]+)",\s*request_type:\s*(None|Some\("([^"]*)"\)),\s*response_type:\s*"([^"]+)"\s*,?\s*\}/gs;
  for (const match of block[1].matchAll(rowRe)) {
    routes.push({
      method: match[1],
      path: match[2],
      requestType: match[3] === "None" ? null : match[4],
      responseType: match[5],
    });
  }
  return routes;
}

export function routeKey(method, pathName) {
  return `${method.toUpperCase()} ${pathName}`;
}

export function diffHttpRoutes(sharedRoutes, rustRoutes) {
  const sharedKeys = sharedRoutes.map((r) => routeKey(r.method, r.path)).sort();
  const rustKeys = rustRoutes.map((r) => routeKey(r.method, r.path)).sort();
  const sharedSet = new Set(sharedKeys);
  const rustSet = new Set(rustKeys);
  const onlyShared = sharedKeys.filter((k) => !rustSet.has(k));
  const onlyRust = rustKeys.filter((k) => !sharedSet.has(k));
  return { onlyShared, onlyRust };
}

export function collectSharedExportedTypeNames(sharedSrcRoot) {
  const names = new Set();
  const exportTypeRe = /export\s+(?:type|interface)\s+(\w+)/g;
  const exportFromRe = /export\s+(?:type\s+)?\{([^}]+)\}\s+from/g;
  const files = listFilesRecursive(
    sharedSrcRoot,
    (p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".d.ts"),
  );
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const code = stripComments(source);
    for (const match of code.matchAll(exportTypeRe)) {
      names.add(match[1]);
    }
    for (const match of code.matchAll(exportFromRe)) {
      for (const part of match[1].split(",")) {
        const chunk = part.trim();
        if (!chunk) continue;
        const alias = chunk.split(/\s+as\s+/);
        names.add(alias[alias.length - 1].trim());
      }
    }
  }
  return names;
}

export function findMissingRouteTypes(sharedRoutes, exportedTypes) {
  const missing = [];
  for (const route of sharedRoutes) {
    if (route.responseType && !exportedTypes.has(route.responseType)) {
      missing.push(`${route.id}: responseType ${route.responseType}`);
    }
    if (route.requestType && !exportedTypes.has(route.requestType)) {
      missing.push(`${route.id}: requestType ${route.requestType}`);
    }
  }
  return missing;
}

export function findRustResponseTypeMismatches(rustRoutes, rustSource) {
  const code = stripComments(rustSource);
  const mismatches = [];
  for (const route of rustRoutes) {
    if (!code.includes(route.responseType)) {
      mismatches.push(
        `${routeKey(route.method, route.path)}: response type ${route.responseType} not referenced in http_api.rs`,
      );
    }
  }
  return mismatches;
}

/** String literals that embed a `/api/...` path (path-only or full loopback URL). */
const API_LITERAL_RE = /(["'`])([^"'`]*\/api\/[^"'`]*)\1/g;

export function apiPathFromLiteral(literal) {
  const trimmed = literal.split("?")[0];
  if (trimmed.startsWith("/api/")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.pathname.startsWith("/api/")) {
      return url.pathname;
    }
  } catch {
    // not a full URL
  }
  const match = /(\/api\/[^\s"'`?]*)/.exec(literal);
  return match ? match[1] : null;
}

function listFilesRecursive(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
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

/**
 * @param {Set<string>} allowedPaths full paths from HTTP_API_ROUTES (no query)
 */
export function findExtensionApiLiteralViolations(extensionDir, allowedPaths) {
  const violations = [];
  const files = listFilesRecursive(
    extensionDir,
    (p) =>
      (p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.endsWith(".test.ts") &&
      !p.endsWith(".test.tsx"),
  );
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const code = stripComments(source);
    for (const match of code.matchAll(API_LITERAL_RE)) {
      const pathName = apiPathFromLiteral(match[2]);
      if (!pathName) continue;
      if (!allowedPaths.has(pathName)) {
        violations.push({
          file: path.relative(repoRoot, file).replaceAll("\\", "/"),
          literal: match[2],
        });
      }
    }
  }
  return violations;
}

export function findExtensionRawApiPathLiterals(extensionDir) {
  const raw = [];
  const files = listFilesRecursive(
    extensionDir,
    (p) =>
      (p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.endsWith(".test.ts") &&
      !p.endsWith(".test.tsx"),
  );
  for (const file of files) {
    const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
    const source = readFileSync(file, "utf8");
    const code = stripComments(source);
    for (const match of code.matchAll(API_LITERAL_RE)) {
      raw.push({ file: rel, literal: match[2] });
    }
  }
  return raw;
}

function main() {
  const contractSource = readFileSync(httpContract, "utf8");
  const rustSource = readFileSync(httpApiRs, "utf8");
  const sharedRoutes = parseSharedHttpRoutes(contractSource);
  const rustRoutes = parseRustHttpRoutes(rustSource);

  if (sharedRoutes.length === 0) {
    console.error("No HTTP_API_ROUTES rows parsed from httpContract.ts");
    process.exit(1);
  }
  if (rustRoutes.length === 0) {
    console.error("No HTTP_API_ROUTE_SPECS rows parsed from http_api.rs");
    process.exit(1);
  }

  let failed = false;
  const { onlyShared, onlyRust } = diffHttpRoutes(sharedRoutes, rustRoutes);
  if (onlyShared.length > 0 || onlyRust.length > 0) {
    failed = true;
    console.error("HTTP API route mismatch between @swallow/shared and infra/http_api.rs:");
    if (onlyShared.length > 0) {
      console.error(`  shared only: ${onlyShared.join(", ")}`);
    }
    if (onlyRust.length > 0) {
      console.error(`  Rust only: ${onlyRust.join(", ")}`);
    }
  }

  for (const shared of sharedRoutes) {
    const rust = rustRoutes.find((r) => r.path === shared.path);
    if (!rust) continue;
    if (rust.method !== shared.method) {
      failed = true;
      console.error(
        `Method mismatch for ${shared.path}: shared=${shared.method}, Rust=${rust.method}`,
      );
    }
    if (rust.responseType !== shared.responseType) {
      failed = true;
      console.error(
        `Response type mismatch for ${shared.path}: shared=${shared.responseType}, Rust=${rust.responseType}`,
      );
    }
    const sharedReq = shared.requestType ?? null;
    const rustReq = rust.requestType ?? null;
    if (sharedReq !== rustReq) {
      failed = true;
      console.error(
        `Request type mismatch for ${shared.path}: shared=${sharedReq}, Rust=${rustReq}`,
      );
    }
  }

  const exportedTypes = collectSharedExportedTypeNames(sharedApiDir);
  const missingTypes = findMissingRouteTypes(sharedRoutes, exportedTypes);
  if (missingTypes.length > 0) {
    failed = true;
    console.error("HTTP API route types not exported from @swallow/shared:");
    for (const item of missingTypes) {
      console.error(`  ${item}`);
    }
  }

  const rustTypeMismatches = findRustResponseTypeMismatches(rustRoutes, rustSource);
  if (rustTypeMismatches.length > 0) {
    failed = true;
    console.error("Rust handler types not found for HTTP API routes:");
    for (const item of rustTypeMismatches) {
      console.error(`  ${item}`);
    }
  }

  const allowedPaths = new Set(sharedRoutes.map((r) => r.path));
  if (existsSync(extensionSrc)) {
    const unknownPaths = findExtensionApiLiteralViolations(extensionSrc, allowedPaths);
    if (unknownPaths.length > 0) {
      failed = true;
      console.error("Extension references unknown HTTP API paths:");
      for (const v of unknownPaths) {
        console.error(`  ${v.file}: ${v.literal}`);
      }
    }
    const rawLiterals = findExtensionRawApiPathLiterals(extensionSrc);
    if (rawLiterals.length > 0) {
      failed = true;
      console.error(
        'Extension must use @swallow/shared HTTP_API_ROUTES / API_PATHS (no raw "/api/..." literals):',
      );
      for (const v of rawLiterals) {
        console.error(`  ${v.file}: ${v.literal}`);
      }
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log(
    `ok (${sharedRoutes.length} HTTP API routes aligned, types exported, extension boundary clean)`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

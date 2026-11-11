#!/usr/bin/env node
/**
 * Enforces desktop layer direction and feature public facade boundaries.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const desktopSrc = path.join(repoRoot, "apps/desktop/src");

const SCAN_SEGMENTS = ["features", "app", "shared", "platform"];

/** Strips line and block comments (TS subset). */
export function stripComments(source) {
  const blockComment = /\/\*[\s\S]*?\*\//g;
  const lineComment = /\/\/[^\n\r]*/g;
  return source.replace(blockComment, "").replace(lineComment, "");
}

const IMPORT_FROM_RE =
  /(?:^|\n|;|\})\s*(?:import|export)\s+(?:type\s+)?(?:[^"'`\n;]*?\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

export function extractModuleSpecifiers(source) {
  const code = stripComments(source);
  const specs = [];
  for (const re of [IMPORT_FROM_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    for (const match of code.matchAll(re)) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function listTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if ((full.endsWith(".ts") || full.endsWith(".tsx")) && !full.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** posix path relative to srcRoot, or null if outside / unresolved package import. */
export function resolveSpecifier(importerFile, specifier, srcRoot = desktopSrc) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null;
  }
  const importerDir = path.dirname(importerFile);
  const resolved = path.resolve(importerDir, specifier);
  const relToSrc = path.relative(srcRoot, resolved).replaceAll("\\", "/");
  if (relToSrc.startsWith("..") || path.isAbsolute(relToSrc)) {
    return null;
  }
  return relToSrc.replace(/\.(tsx?|mts|cts)$/, "");
}

export function layerOf(relPosix) {
  const [top] = relPosix.split("/");
  if (top === "shared" || top === "platform" || top === "features" || top === "app") {
    return top;
  }
  return null;
}

export function featureName(relPosix) {
  const m = /^features\/([^/]+)/.exec(relPosix);
  return m ? m[1] : null;
}

export function isPublicFeatureEntry(relPosix) {
  const m = /^features\/([^/]+)(?:\/(.*))?$/.exec(relPosix);
  if (!m) return false;
  const rest = m[2] ?? "";
  if (rest === "" || rest === "index") return true;
  if (rest === "api") return true;
  return false;
}

export function checkLayerViolation(importerLayer, targetLayer) {
  if (!importerLayer || !targetLayer) return null;
  if (importerLayer === "shared" && (targetLayer === "features" || targetLayer === "app")) {
    return "shared must not import from features or app";
  }
  if (importerLayer === "platform" && (targetLayer === "features" || targetLayer === "app")) {
    return "platform must not import from features or app";
  }
  if (importerLayer === "features" && targetLayer === "app") {
    return "features must not import from app";
  }
  return null;
}

export function checkFacadeViolation(importerRel, targetRel) {
  const importerFeature = featureName(importerRel);
  const targetFeature = featureName(targetRel);
  if (!targetFeature) return null;
  if (importerFeature === targetFeature) return null;
  if (isPublicFeatureEntry(targetRel)) return null;
  return `import into features/${targetFeature} must use features/${targetFeature} or features/${targetFeature}/api`;
}

export function findBoundaryViolations(options = {}) {
  const root = options.desktopSrc ?? desktopSrc;
  const violations = [];
  for (const segment of SCAN_SEGMENTS) {
    const dir = path.join(root, segment);
    if (!existsSync(dir)) continue;
    for (const file of listTsFiles(dir)) {
      const importerRel = path.relative(root, file).replaceAll("\\", "/");
      const importerLayer = layerOf(importerRel);
      const source = readFileSync(file, "utf8");
      for (const spec of extractModuleSpecifiers(source)) {
        const targetRel = resolveSpecifier(file, spec, root);
        if (!targetRel) continue;
        const targetLayer = layerOf(targetRel);
        const layerMsg = checkLayerViolation(importerLayer, targetLayer);
        if (layerMsg) {
          violations.push({
            file: importerRel,
            specifier: spec,
            target: targetRel,
            rule: "layer",
            message: layerMsg,
          });
          continue;
        }
        const facadeMsg = checkFacadeViolation(importerRel, targetRel);
        if (facadeMsg) {
          violations.push({
            file: importerRel,
            specifier: spec,
            target: targetRel,
            rule: "facade",
            message: facadeMsg,
          });
        }
      }
    }
  }
  return violations;
}

export function formatViolations(violations) {
  return violations.map(
    (v) => `${v.file}: "${v.specifier}" → ${v.target} (${v.rule}: ${v.message})`,
  );
}

function main() {
  const violations = findBoundaryViolations();
  if (violations.length > 0) {
    console.error("Feature boundary violations:");
    for (const line of formatViolations(violations)) {
      console.error(`  ${line}`);
    }
    process.exit(1);
  }
  console.log("ok (layer direction and feature facades clean)");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

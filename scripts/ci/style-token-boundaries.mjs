#!/usr/bin/env node
/**
 * Enforces semantic design-token usage in desktop CSS and feature/app TSX.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const desktopSrc = path.join(repoRoot, "apps/desktop/src");
const tokensCssRel = "styles/tokens.css";

/** Matches raw color literals (#rgb, #rrggbb, functional colors). */
export const COLOR_LITERAL_RE =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:\b(?:rgb|rgba|hsl|hsla|oklch)\s*\()/;

const VISUAL_STYLE_PROPS = new Set([
  "color",
  "background",
  "backgroundColor",
  "borderColor",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "borderRadius",
  "boxShadow",
  "textShadow",
  "filter",
  "backdropFilter",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "border",
  "outline",
  "outlineColor",
  "outlineWidth",
  "fill",
  "stroke",
]);

const LAYOUT_STYLE_PROPS = new Set([
  "left",
  "top",
  "right",
  "bottom",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "transform",
  "visibility",
  "position",
  "zIndex",
  "display",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "flexDirection",
  "alignItems",
  "alignSelf",
  "justifyContent",
  "justifySelf",
  "gridColumn",
  "gridRow",
  "order",
  "overflow",
  "pointerEvents",
  "userSelect",
  "cursor",
  "objectFit",
  "aspectRatio",
]);

/** Strips line and block comments (CSS / TS subset). */
export function stripComments(source) {
  const blockComment = /\/\*[\s\S]*?\*\//g;
  const lineComment = /\/\/[^\n\r]*/g;
  return source.replace(blockComment, "").replace(lineComment, "");
}

export function containsRawColorLiteral(fragment) {
  return COLOR_LITERAL_RE.test(fragment);
}

export function isCustomStyleProp(key) {
  return key.startsWith("--");
}

export function isHardcodedVisualStyleValue(prop, rawValue) {
  const value = rawValue.trim().replace(/\s+as\s+const\s*$/, "");
  if (isCustomStyleProp(prop)) {
    return false;
  }
  if (LAYOUT_STYLE_PROPS.has(prop)) {
    return false;
  }
  if (!VISUAL_STYLE_PROPS.has(prop)) {
    return false;
  }
  if (/^[A-Za-z_$][\w$[\].]*$/.test(value)) {
    return false;
  }
  if (containsRawColorLiteral(value)) {
    return true;
  }
  const unquoted = value.replace(/^['"`]|['"`]$/g, "");
  if (/^\d+(\.\d+)?(px|rem|em)$/.test(unquoted)) {
    return true;
  }
  if (/^\d+(\.\d+)?$/.test(unquoted) && (prop === "fontSize" || prop === "fontWeight")) {
    return true;
  }
  if (/^`[^`]*\d+(\.\d+)?px/.test(value)) {
    return true;
  }
  return false;
}

/** Extracts inline `style={{ ... }}` object bodies from TSX source. */
export function extractInlineStyleObjects(source) {
  const code = stripComments(source);
  const objects = [];
  let i = 0;
  while (i < code.length) {
    const idx = code.indexOf("style={{", i);
    if (idx === -1) break;
    let depth = 0;
    const start = idx + "style=".length;
    if (code[start] !== "{") {
      i = idx + 1;
      continue;
    }
    let j = start;
    for (; j < code.length; j++) {
      const ch = code[j];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const body = code.slice(start + 1, j);
          objects.push({ body, index: idx });
          i = j + 1;
          break;
        }
      }
    }
    if (j >= code.length) break;
  }
  return objects;
}

export function findInlineStyleViolations(source) {
  const violations = [];
  for (const { body, index } of extractInlineStyleObjects(source)) {
    const cleaned = body.replace(/\s+as\s+CSSProperties\s*$/, "");
    const propRe = /(?:^|[,{])\s*(?:['"]([^'"]+)['"]|([a-zA-Z_$][\w$-]*))\s*:\s*([^,}]+)/g;
    for (const match of cleaned.matchAll(propRe)) {
      const key = match[1] ?? match[2];
      const value = match[3];
      if (isHardcodedVisualStyleValue(key, value)) {
        violations.push({ index, prop: key, value: value.trim() });
      }
    }
  }
  return violations;
}

function listFiles(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFiles(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

export function findCssViolations(options = {}) {
  const root = options.desktopSrc ?? desktopSrc;
  const violations = [];
  for (const file of listFiles(root, (f) => f.endsWith(".css"))) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    if (rel === tokensCssRel) continue;
    const source = readFileSync(file, "utf8");
    const stripped = stripComments(source);
    if (containsRawColorLiteral(stripped)) {
      violations.push({
        file: rel,
        rule: "css-color-literal",
        message: "raw color literal in CSS (use tokens.css semantic variables)",
      });
    }
  }
  return violations;
}

export function findTsxViolations(options = {}) {
  const root = options.desktopSrc ?? desktopSrc;
  const scanRoots = ["features", "app"].map((seg) => path.join(root, seg));
  const violations = [];
  for (const dir of scanRoots) {
    for (const file of listFiles(dir, (f) => f.endsWith(".tsx"))) {
      const rel = path.relative(root, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      const stripped = stripComments(source);
      if (containsRawColorLiteral(stripped)) {
        violations.push({
          file: rel,
          rule: "tsx-color-literal",
          message: "raw color literal in feature/app TSX",
        });
      }
      for (const v of findInlineStyleViolations(source)) {
        violations.push({
          file: rel,
          rule: "tsx-inline-style",
          message: `hardcoded visual style ${v.prop}: ${v.value}`,
        });
      }
    }
  }
  return violations;
}

export function findStyleTokenViolations(options = {}) {
  return [...findCssViolations(options), ...findTsxViolations(options)];
}

export function formatViolations(violations) {
  return violations.map((v) => `${v.file}: (${v.rule}: ${v.message})`);
}

function main() {
  const violations = findStyleTokenViolations();
  if (violations.length > 0) {
    console.error("Style token boundary violations:");
    for (const line of formatViolations(violations)) {
      console.error(`  ${line}`);
    }
    process.exit(1);
  }
  console.log("ok (semantic design tokens; no raw visual literals in features/app)");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

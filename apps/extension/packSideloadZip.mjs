/**
 * Zip `apps/extension/dist` for Chrome unpacked sideload.
 *
 * The archive root is the extension root (`manifest.json` at the top).
 * `key` stays in the manifest so Chrome keeps the development ID.
 * This zip is not a Chrome Web Store package and it is not signed.
 * Timestamps are fixed so the same dist produces the same bytes.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const EOCD = 0x06054b50;
const UTF8_FLAG = 0x0800;
const ZIP_VERSION = 20;
/** 1980-01-01. ZIP dates cannot be earlier, and a fixed date keeps builds reproducible. */
const ZIP_DATE = 0x0021;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;
const PINNED_ID_RE = /export const PINNED_EXTENSION_ID = "([a-p]{32})"/;
const HTML_REF_RE = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
const JS_IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']+)["']/g;

export class SideloadPackError extends Error {
  constructor(message) {
    super(message);
    this.name = "SideloadPackError";
  }
}

export function extensionIdFromPublicKeyBase64(key) {
  const der = Buffer.from(key, "base64");
  if (der.length === 0 || der.length > 512) {
    throw new SideloadPackError("manifest の key は RSA 公開鍵の Base64 ではありません");
  }
  const digest = createHash("sha256").update(der).digest();
  const alphabet = "abcdefghijklmnop";
  let id = "";
  for (let i = 0; i < 16; i++) {
    const byte = digest[i];
    if (byte === undefined) {
      throw new SideloadPackError("SHA-256 が 16 バイトより短いです");
    }
    const hi = alphabet[byte >> 4];
    const lo = alphabet[byte & 0x0f];
    if (hi === undefined || lo === undefined) {
      throw new SideloadPackError("拡張 ID の変換に失敗しました");
    }
    id += hi + lo;
  }
  return id;
}

export function readPinnedExtensionId(source) {
  const match = PINNED_ID_RE.exec(source);
  if (!match?.[1]) {
    throw new SideloadPackError("PINNED_EXTENSION_ID が読めません");
  }
  return match[1];
}

export function normalizeZipPath(name) {
  const posix = name.replaceAll("\\", "/");
  if (
    posix === "" ||
    posix.startsWith("/") ||
    posix.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new SideloadPackError(`zip に入れられないパスです: ${name}`);
  }
  return posix;
}

function assertNoPrivateMaterial(name, bytes) {
  if (/\.(pem|key|der)$/i.test(name)) {
    throw new SideloadPackError(`秘密鍵ファイルは zip に入れません: ${name}`);
  }
  if (PRIVATE_KEY_RE.test(bytes.toString("latin1"))) {
    throw new SideloadPackError(`秘密鍵の中身は zip に入れません: ${name}`);
  }
}

export function assertSideloadManifest(manifest, pinnedId) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new SideloadPackError("manifest.json がオブジェクトではありません");
  }
  if (manifest.manifest_version !== 3) {
    throw new SideloadPackError("Chrome Manifest V3 以外は配布しません");
  }
  if (manifest.browser_specific_settings !== undefined) {
    throw new SideloadPackError("Firefox 用の browser_specific_settings は置きません");
  }
  if (manifest.update_url !== undefined) {
    throw new SideloadPackError("update_url は置きません。未パックは自動更新しません");
  }
  const min = Number(manifest.minimum_chrome_version);
  if (!Number.isInteger(min) || min < 120) {
    throw new SideloadPackError("minimum_chrome_version は 120 以上です");
  }
  if (typeof manifest.version !== "string" || !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    throw new SideloadPackError("manifest.version が zip のファイル名に使えません");
  }
  if (typeof manifest.key !== "string" || manifest.key === "") {
    throw new SideloadPackError("サイドロード用 zip には manifest の key が必要です");
  }
  const id = extensionIdFromPublicKeyBase64(manifest.key);
  if (id !== pinnedId) {
    throw new SideloadPackError(
      `拡張 ID が開発用 ID と違います（zip は ${id}、開発用は ${pinnedId}）`,
    );
  }
  return { version: manifest.version, extensionId: id };
}

function resolveRelative(fromFile, ref) {
  const clean = ref.split(/[?#]/, 1)[0] ?? "";
  if (clean === "" || clean.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    return null;
  }
  const base = path.posix.dirname(fromFile);
  const joined = path.posix.normalize(path.posix.join(base, clean));
  if (joined.startsWith("..") || path.posix.isAbsolute(joined)) {
    throw new SideloadPackError(`${fromFile} の参照が dist の外です: ${ref}`);
  }
  return joined;
}

function referencedNames(file, names) {
  const text = file.data.toString("utf8");
  const pattern = file.name.endsWith(".html")
    ? HTML_REF_RE
    : file.name.endsWith(".js")
      ? JS_IMPORT_RE
      : null;
  if (!pattern) return;
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const ref = match[1];
    if (!ref) continue;
    const resolved = resolveRelative(file.name, ref);
    if (resolved) names.add(resolved);
  }
}

function manifestAssetPaths(manifest) {
  const paths = [];
  const worker = manifest.background?.service_worker;
  if (typeof worker === "string") paths.push(worker);
  const popup = manifest.action?.default_popup;
  if (typeof popup === "string") paths.push(popup);
  const icon = manifest.action?.default_icon;
  if (typeof icon === "string") paths.push(icon);
  if (icon !== null && typeof icon === "object") {
    for (const value of Object.values(icon)) {
      if (typeof value === "string") paths.push(value);
    }
  }
  if (manifest.icons !== null && typeof manifest.icons === "object") {
    for (const value of Object.values(manifest.icons)) {
      if (typeof value === "string") paths.push(value);
    }
  }
  return paths;
}

function assertReferencedFiles(manifest, files) {
  const byName = new Map(files.map((file) => [file.name, file]));
  const needed = new Set();
  for (const asset of manifestAssetPaths(manifest)) {
    const resolved = resolveRelative("manifest.json", asset);
    if (resolved) needed.add(resolved);
  }
  const pending = [...needed];
  const seen = new Set(pending);
  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined) break;
    const file = byName.get(name);
    if (!file) {
      throw new SideloadPackError(`manifest が参照するファイルが dist にありません: ${name}`);
    }
    const nested = new Set();
    referencedNames(file, nested);
    for (const child of nested) {
      if (!seen.has(child)) {
        seen.add(child);
        pending.push(child);
      }
    }
  }
}

function collectDistFiles(distDir) {
  if (!existsSync(path.join(distDir, "manifest.json"))) {
    throw new SideloadPackError(
      "dist/manifest.json がありません。先に pnpm --filter @swallow/extension build を実行してください",
    );
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const full = path.join(dir, entry.name);
      const name = normalizeZipPath(path.relative(distDir, full).split(path.sep).join("/"));
      if (entry.isSymbolicLink()) {
        throw new SideloadPackError(`シンボリックリンクは zip に入れません: ${name}`);
      }
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) {
        throw new SideloadPackError(`通常ファイルではありません: ${name}`);
      }
      if (name.endsWith(".map")) continue;
      const data = readFileSync(full);
      assertNoPrivateMaterial(name, data);
      files.push({ name, data });
    }
  };
  walk(distDir);
  files.sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
  return files;
}

export function zipStore(files) {
  const parts = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(normalizeZipPath(file.name), "utf8");
    const data = file.data;
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(ZIP_VERSION, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(ZIP_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    parts.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(ZIP_VERSION, 4);
    central.writeUInt16LE(ZIP_VERSION, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(ZIP_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, eocd]);
}

export function listZipEntries(buffer) {
  if (buffer.length < 22) throw new SideloadPackError("zip が短すぎます");
  const eocd = buffer.length - 22;
  if (buffer.readUInt32LE(eocd) !== EOCD) throw new SideloadPackError("EOCD がありません");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (centralOffset + centralSize !== eocd) {
    throw new SideloadPackError("central directory の長さが合いません");
  }
  const entries = [];
  let pos = centralOffset;
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(pos) !== CENTRAL) {
      throw new SideloadPackError("central header が壊れています");
    }
    if (buffer.readUInt16LE(pos + 10) !== 0) {
      throw new SideloadPackError("store 以外の zip は読みません");
    }
    const size = buffer.readUInt32LE(pos + 20);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString("utf8", pos + 46, pos + 46 + nameLen);
    if (buffer.readUInt32LE(localOffset) !== LOCAL) {
      throw new SideloadPackError("local header が壊れています");
    }
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    entries.push({
      name,
      data: Buffer.from(buffer.subarray(dataStart, dataStart + size)),
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (pos !== eocd) throw new SideloadPackError("central directory を読み切れませんでした");
  return entries;
}

function writeAtomic(outFile, bytes) {
  mkdirSync(path.dirname(outFile), { recursive: true });
  const partial = `${outFile}.${process.pid}.partial`;
  try {
    writeFileSync(partial, bytes);
    renameSync(partial, outFile);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
}

function assertOutNotInsideDist(outFile, distDir) {
  const out = path.resolve(outFile);
  const dist = path.resolve(distDir);
  if (out === dist || out.startsWith(dist + path.sep)) {
    throw new SideloadPackError("zip の出力先は dist の外にしてください");
  }
}

export function packSideloadDist({ extensionRoot, distDir, outFile, pinnedId }) {
  const root = extensionRoot;
  const dist = distDir ?? path.join(root, "dist");
  const id =
    pinnedId ??
    readPinnedExtensionId(readFileSync(path.join(root, "src/pinnedExtensionId.ts"), "utf8"));
  const files = collectDistFiles(dist);
  const manifestFile = files.find((file) => file.name === "manifest.json");
  if (!manifestFile) {
    throw new SideloadPackError("dist に manifest.json がありません");
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestFile.data.toString("utf8"));
  } catch {
    throw new SideloadPackError("dist/manifest.json が JSON ではありません");
  }
  const checked = assertSideloadManifest(manifest, id);
  assertReferencedFiles(manifest, files);
  const bytes = zipStore(files);
  const dest = outFile ?? path.join(root, `swallow-extension-${checked.version}-sideload.zip`);
  assertOutNotInsideDist(dest, dist);
  writeAtomic(dest, bytes);
  return {
    outFile: dest,
    version: checked.version,
    extensionId: checked.extensionId,
    names: files.map((file) => file.name),
  };
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectRun()) {
  try {
    const extensionRoot = path.dirname(fileURLToPath(import.meta.url));
    const result = packSideloadDist({ extensionRoot });
    console.log(result.outFile);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

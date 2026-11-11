import { SUPPORTED_IMPORT_EXTENSIONS } from "@swallow/shared";

/**
 * Chrome delivers extension messages as JSON, capped near 64MiB.
 * Base64 grows by 4/3, so raw bytes must stay below that cap.
 * Direct service-worker fetches are not subject to this limit.
 */
export const MAX_PAGE_TRANSFER_BYTES = 32 * 1024 * 1024;

const SUPPORTED_EXTS = new Set<string>(SUPPORTED_IMPORT_EXTENSIONS);

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export type ImageScheme = "http" | "data" | "blob" | "other";

export interface ImageParts {
  name?: string;
  ext?: string;
  mime: string;
}

export interface DecodedDataUrl {
  bytes: Uint8Array;
  mime: string;
}

export function imageScheme(srcUrl: string): ImageScheme {
  const colon = srcUrl.indexOf(":");
  const scheme = (colon >= 0 ? srcUrl.slice(0, colon) : "").toLowerCase();
  if (scheme === "http" || scheme === "https") return "http";
  if (scheme === "data") return "data";
  if (scheme === "blob") return "blob";
  return "other";
}

/** http(s) page URL stored on `ItemMetadata.url`. Other schemes are omitted. */
export function sourcePageUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function isSupportedImportExt(ext: string): boolean {
  return SUPPORTED_EXTS.has(ext);
}

export function extFromMime(contentType: string | null | undefined): string | undefined {
  const mime = mimeType(contentType);
  if (!mime) return undefined;
  return MIME_TO_EXT[mime];
}

export function mimeForExt(ext: string | undefined): string {
  if (!ext) return "application/octet-stream";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

export function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    let part = "";
    for (let j = 0; j < slice.length; j += 1) {
      part += String.fromCharCode(slice[j] ?? 0);
    }
    binary += part;
  }
  return btoa(binary);
}

export function decodeDataUrl(srcUrl: string): DecodedDataUrl | null {
  if (!srcUrl.toLowerCase().startsWith("data:")) return null;
  const comma = srcUrl.indexOf(",");
  if (comma < 0) return null;
  const meta = srcUrl.slice("data:".length, comma);
  const payload = srcUrl.slice(comma + 1);
  const base64 = /;base64$/i.test(meta);
  const mime = meta.slice(0, base64 ? meta.length - ";base64".length : meta.length);
  const type =
    mimeType(mime) ??
    (mime.trim() === "" ? "text/plain" : mime.split(";")[0]?.trim().toLowerCase());
  if (!type) return null;
  try {
    if (base64) {
      return { bytes: bytesFromBase64(payload), mime: type };
    }
    const text = decodeURIComponent(payload);
    return { bytes: new TextEncoder().encode(text), mime: type };
  } catch {
    return null;
  }
}

export function imageParts(input: {
  srcUrl?: string;
  contentType?: string | null;
  bytes?: Uint8Array;
  name?: string;
}): ImageParts {
  const fromUrl = input.srcUrl ? nameAndExtFromUrl(input.srcUrl) : {};
  const fromType = extFromMime(input.contentType);
  const sniffed = input.bytes ? sniffExt(input.bytes) : undefined;
  const urlExt = fromUrl.ext;
  const ext = fromType ?? sniffed ?? urlExt;
  return {
    name: cleanStem(input.name) ?? fromUrl.name,
    ext,
    mime: mimeForExt(ext),
  };
}

export function sniffExt(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 8 &&
    at(bytes, 0) === 0x89 &&
    at(bytes, 1) === 0x50 &&
    at(bytes, 2) === 0x4e &&
    at(bytes, 3) === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 3 &&
    at(bytes, 0) === 0xff &&
    at(bytes, 1) === 0xd8 &&
    at(bytes, 2) === 0xff
  ) {
    return "jpg";
  }
  if (
    bytes.length >= 6 &&
    at(bytes, 0) === 0x47 &&
    at(bytes, 1) === 0x49 &&
    at(bytes, 2) === 0x46 &&
    at(bytes, 3) === 0x38 &&
    (at(bytes, 4) === 0x37 || at(bytes, 4) === 0x39) &&
    at(bytes, 5) === 0x61
  ) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    at(bytes, 0) === 0x52 &&
    at(bytes, 1) === 0x49 &&
    at(bytes, 2) === 0x46 &&
    at(bytes, 3) === 0x46 &&
    at(bytes, 8) === 0x57 &&
    at(bytes, 9) === 0x45 &&
    at(bytes, 10) === 0x42 &&
    at(bytes, 11) === 0x50
  ) {
    return "webp";
  }
  if (
    bytes.length >= 5 &&
    at(bytes, 0) === 0x25 &&
    at(bytes, 1) === 0x50 &&
    at(bytes, 2) === 0x44 &&
    at(bytes, 3) === 0x46 &&
    at(bytes, 4) === 0x2d
  ) {
    return "pdf";
  }
  return undefined;
}

function at(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? -1;
}

function mimeType(contentType: string | null | undefined): string | undefined {
  if (!contentType) return undefined;
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "" ? undefined : mime;
}

function nameAndExtFromUrl(srcUrl: string): { name?: string; ext?: string } {
  let segment = "";
  try {
    segment = new URL(srcUrl).pathname.split("/").pop() ?? "";
  } catch {
    return {};
  }
  if (!segment) return {};
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  const dot = decoded.lastIndexOf(".");
  if (dot > 0) {
    const ext = decoded.slice(dot + 1);
    if (/^[a-z0-9]{1,8}$/i.test(ext)) {
      return { name: cleanStem(decoded.slice(0, dot)), ext: ext.toLowerCase() };
    }
  }
  return { name: cleanStem(decoded) };
}

function cleanStem(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "..") return undefined;
  return trimmed;
}

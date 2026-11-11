export interface ListedImage {
  index: number;
  label: string;
  width: number;
  height: number;
  /** http(s) or blob URL. Data URLs are omitted so the list message stays small. */
  srcUrl?: string;
}

export type PageBytesResult =
  | { ok: true; base64: string; mime: string }
  | { ok: false; reason: "fetch" | "tooLarge" | "empty" };

export type PageImageResult =
  | { ok: true; mode: "url"; url: string }
  | { ok: true; mode: "bytes"; base64: string; mime: string }
  | { ok: false; reason: "missing" | "fetch" | "tooLarge" | "empty" | "unsupported" };

/**
 * Passed to `chrome.scripting.executeScript`, which serializes this function alone.
 * Nested helpers stay inside the function so they survive that serialization.
 * Blob URLs can be read only in the tab that created them. `maxBytes` is the transfer cap.
 */
export async function readBlobUrlInPage(
  blobUrl: string,
  maxBytes: number,
): Promise<PageBytesResult> {
  function headerMime(contentType: string | null): string {
    return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  }
  function encodeBase64(bytes: Uint8Array): string {
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

  let response: Response;
  try {
    response = await fetch(blobUrl);
  } catch {
    return { ok: false, reason: "fetch" };
  }
  if (!response.ok) return { ok: false, reason: "fetch" };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > maxBytes) return { ok: false, reason: "tooLarge" };
  return {
    ok: true,
    base64: encodeBase64(bytes),
    mime: headerMime(response.headers.get("content-type")),
  };
}

/**
 * Top frame only. Loaded images smaller than 8px on both sides are skipped (tracking pixels).
 * Images that have not loaded (`naturalWidth === 0`) are kept.
 */
export function listImagesInPage(): ListedImage[] {
  function schemeOf(src: string): string {
    const colon = src.indexOf(":");
    return (colon >= 0 ? src.slice(0, colon) : "").toLowerCase();
  }
  function imageLabel(alt: string, src: string, scheme: string, displayIndex: number): string {
    const trimmed = (alt || "").trim();
    if (trimmed) return trimmed.slice(0, 80);
    if (scheme === "http" || scheme === "https") {
      try {
        const segment = decodeURIComponent(new URL(src).pathname.split("/").pop() ?? "");
        if (segment.trim()) return segment.trim().slice(0, 80);
      } catch {
        // Numbered fallback below.
      }
    }
    return `画像 ${displayIndex}`;
  }

  const images = document.images;
  const seen = new Set<string>();
  const listed: ListedImage[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const img = images[index];
    if (!img) continue;
    const src = img.currentSrc || img.src;
    if (!src || seen.has(src)) continue;
    const scheme = schemeOf(src);
    if (scheme !== "http" && scheme !== "https" && scheme !== "data" && scheme !== "blob") continue;
    seen.add(src);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (width > 0 && height > 0 && width < 8 && height < 8) continue;
    const entry: ListedImage = {
      index,
      label: imageLabel(img.alt, src, scheme, listed.length + 1),
      width,
      height,
    };
    if (scheme === "http" || scheme === "https" || scheme === "blob") {
      entry.srcUrl = src;
    }
    listed.push(entry);
  }
  return listed;
}

/** Data URLs are decoded in the tab so an oversized URL is rejected before it is messaged back. */
export async function readImageAtInPage(index: number, maxBytes: number): Promise<PageImageResult> {
  function schemeOf(src: string): string {
    const colon = src.indexOf(":");
    return (colon >= 0 ? src.slice(0, colon) : "").toLowerCase();
  }
  function encodeBase64(bytes: Uint8Array): string {
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
  function decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  function decodeDataUrl(
    src: string,
  ):
    | { ok: true; bytes: Uint8Array; mime: string }
    | { ok: false; reason: "fetch" | "tooLarge" | "empty" } {
    const comma = src.indexOf(",");
    if (comma < 0) return { ok: false, reason: "fetch" };
    const meta = src.slice("data:".length, comma);
    const payload = src.slice(comma + 1);
    const base64 = /;base64$/i.test(meta);
    const mime =
      (base64 ? meta.slice(0, -";base64".length) : meta).split(";")[0]?.trim().toLowerCase() ?? "";
    if (base64) {
      const estimated = Math.floor((payload.replace(/\s/g, "").length * 3) / 4);
      if (estimated > maxBytes) return { ok: false, reason: "tooLarge" };
    } else if (payload.length > maxBytes * 3) {
      return { ok: false, reason: "tooLarge" };
    }
    try {
      const bytes = base64
        ? decodeBase64(payload)
        : new TextEncoder().encode(decodeURIComponent(payload));
      if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
      if (bytes.byteLength > maxBytes) return { ok: false, reason: "tooLarge" };
      return { ok: true, bytes, mime: mime || "text/plain" };
    } catch {
      return { ok: false, reason: "fetch" };
    }
  }

  const img = document.images[index];
  if (!img) return { ok: false, reason: "missing" };
  const src = img.currentSrc || img.src;
  if (!src) return { ok: false, reason: "missing" };
  const scheme = schemeOf(src);
  if (scheme === "http" || scheme === "https" || scheme === "blob") {
    return { ok: true, mode: "url", url: src };
  }
  if (scheme !== "data") return { ok: false, reason: "unsupported" };
  const decoded = decodeDataUrl(src);
  if (!decoded.ok) return decoded;
  return { ok: true, mode: "bytes", base64: encodeBase64(decoded.bytes), mime: decoded.mime };
}

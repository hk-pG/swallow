import type { AddItemQuery } from "@swallow/shared";
import { postAddItem } from "./desktopClient";
import {
  bytesFromBase64,
  decodeDataUrl,
  type ImageParts,
  imageParts,
  imageScheme,
  isSupportedImportExt,
  sourcePageUrl,
} from "./imageBytes";
import type { PageBytesResult } from "./pageImage";
import {
  IMAGE_FETCH_FAILED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  SAVED_MESSAGE,
  UNSUPPORTED_IMAGE_MESSAGE,
} from "./userMessage";

export type SaveTextResult = { ok: true; message: string } | { ok: false; message: string };

type LoadedResult = { ok: true; image: LoadedImage } | { ok: false; message: string };

export interface LoadedImage {
  bytes: Uint8Array;
  mime: string;
  name?: string;
  ext?: string;
}

export interface SaveDeps {
  fetch: typeof fetch;
  readBlobInTab: (blobUrl: string) => Promise<PageBytesResult>;
}

export async function saveFromSrcUrl(
  input: { srcUrl: string; pageUrl?: string },
  deps: SaveDeps,
): Promise<SaveTextResult> {
  const loaded = await loadSrc(input.srcUrl, deps);
  if (!loaded.ok) return loaded;
  return saveLoadedImage(loaded.image, input.pageUrl, deps.fetch);
}

export async function saveLoadedImage(
  image: LoadedImage,
  pageUrl: string | undefined,
  fetchImpl: typeof fetch,
): Promise<SaveTextResult> {
  if (image.bytes.byteLength === 0) {
    return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  }
  if (!image.ext || !isSupportedImportExt(image.ext)) {
    return { ok: false, message: UNSUPPORTED_IMAGE_MESSAGE };
  }
  const posted = await postAddItem(
    { bytes: image.bytes, mime: image.mime, query: addItemQuery(image, pageUrl) },
    fetchImpl,
  );
  if (!posted.ok) return posted;
  return { ok: true, message: SAVED_MESSAGE };
}

async function loadSrc(srcUrl: string, deps: SaveDeps): Promise<LoadedResult> {
  const scheme = imageScheme(srcUrl);
  if (scheme === "http") return loadRemote(srcUrl, deps.fetch);
  if (scheme === "data") return loadData(srcUrl);
  if (scheme === "blob") return loadBlob(srcUrl, deps.readBlobInTab);
  return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
}

async function loadRemote(srcUrl: string, fetchImpl: typeof fetch): Promise<LoadedResult> {
  let response: Response;
  try {
    response = await fetchImpl(srcUrl, { credentials: "include" });
  } catch {
    return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  }
  if (!response.ok) return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  const bytes = new Uint8Array(await response.arrayBuffer());
  return finishParts(
    bytes,
    imageParts({ srcUrl, contentType: response.headers.get("content-type"), bytes }),
  );
}

function loadData(srcUrl: string): LoadedResult {
  const decoded = decodeDataUrl(srcUrl);
  if (!decoded) return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  return finishParts(
    decoded.bytes,
    imageParts({ contentType: decoded.mime, bytes: decoded.bytes }),
  );
}

async function loadBlob(
  srcUrl: string,
  readBlobInTab: SaveDeps["readBlobInTab"],
): Promise<LoadedResult> {
  let read: PageBytesResult;
  try {
    read = await readBlobInTab(srcUrl);
  } catch {
    return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  }
  if (!read.ok) {
    return {
      ok: false,
      message: read.reason === "tooLarge" ? IMAGE_TOO_LARGE_MESSAGE : IMAGE_FETCH_FAILED_MESSAGE,
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64(read.base64);
  } catch {
    return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  }
  return finishParts(bytes, imageParts({ contentType: read.mime, bytes }));
}

function finishParts(bytes: Uint8Array, parts: ImageParts): LoadedResult {
  if (bytes.byteLength === 0) return { ok: false, message: IMAGE_FETCH_FAILED_MESSAGE };
  if (!parts.ext || !isSupportedImportExt(parts.ext)) {
    return { ok: false, message: UNSUPPORTED_IMAGE_MESSAGE };
  }
  return { ok: true, image: { bytes, mime: parts.mime, name: parts.name, ext: parts.ext } };
}

function addItemQuery(image: LoadedImage, pageUrl: string | undefined): AddItemQuery {
  const query: AddItemQuery = {};
  if (image.name) query.name = image.name;
  if (image.ext) query.ext = image.ext;
  const page = sourcePageUrl(pageUrl);
  if (page) query.url = page;
  return query;
}

import { type AddItemQuery, type ApiError, addItemPath, type ItemMetadata } from "@swallow/shared";
import { LOOPBACK_ORIGIN } from "./loopback";
import {
  APP_NOT_RUNNING_MESSAGE,
  EXTENSION_FORBIDDEN_MESSAGE,
  LIBRARY_NOT_OPEN_MESSAGE,
  SAVE_FAILED_MESSAGE,
} from "./userMessage";

export interface AddItemBody {
  bytes: Uint8Array;
  mime: string;
  query: AddItemQuery;
}

export type DesktopPostResult = { ok: true; item: ItemMetadata } | { ok: false; message: string };

/**
 * Service-worker fetch only. A content-script fetch would send the page Origin, which the desktop app rejects.
 * Chrome sets `Origin: chrome-extension://…` and `Host` from this 127.0.0.1 URL; script cannot set either header.
 * A rejected fetch is "app not running". HTTP statuses are reported separately and are not retried.
 */
export function desktopAddItemUrl(query: AddItemQuery): string {
  return `${LOOPBACK_ORIGIN}${addItemPath(query)}`;
}

export function messageForDesktopResponse(status: number, bodyText: string): DesktopPostResult {
  if (status === 201) {
    return parseCreatedItem(bodyText);
  }
  if (status === 403) {
    return { ok: false, message: EXTENSION_FORBIDDEN_MESSAGE };
  }
  const error = parseApiError(bodyText);
  if (!error) {
    return { ok: false, message: SAVE_FAILED_MESSAGE };
  }
  if (status === 503 && error.code === "libraryNotOpen") {
    return { ok: false, message: LIBRARY_NOT_OPEN_MESSAGE };
  }
  return { ok: false, message: error.message };
}

export async function postAddItem(
  body: AddItemBody,
  fetchImpl: typeof fetch,
): Promise<DesktopPostResult> {
  let response: Response;
  try {
    response = await fetchImpl(desktopAddItemUrl(body.query), {
      method: "POST",
      headers: { "Content-Type": body.mime },
      body: blobFromBytes(body.bytes, body.mime),
    });
  } catch {
    return { ok: false, message: APP_NOT_RUNNING_MESSAGE };
  }
  let text = "";
  try {
    text = await response.text();
  } catch {
    return { ok: false, message: SAVE_FAILED_MESSAGE };
  }
  return messageForDesktopResponse(response.status, text);
}

function parseCreatedItem(bodyText: string): DesktopPostResult {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (isItemMetadata(parsed)) {
      return { ok: true, item: parsed };
    }
  } catch {
    // Fall through to the generic failure.
  }
  return { ok: false, message: SAVE_FAILED_MESSAGE };
}

function parseApiError(bodyText: string): ApiError | null {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.code !== "string" || typeof record.message !== "string") return null;
    return { code: record.code as ApiError["code"], message: record.message };
  } catch {
    return null;
  }
}

function blobFromBytes(bytes: Uint8Array, mime: string): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], { type: mime });
}

function isItemMetadata(value: unknown): value is ItemMetadata {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id !== "" &&
    typeof record.name === "string" &&
    typeof record.ext === "string"
  );
}

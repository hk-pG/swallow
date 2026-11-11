import type { ListedImage } from "./pageImage";

export interface ListImagesRequest {
  type: "list-images";
  tabId: number;
}

export interface SaveImageRequest {
  type: "save-image";
  tabId: number;
  imageIndex: number;
  srcUrl?: string;
}

export type ExtensionRequest = ListImagesRequest | SaveImageRequest;

export type ExtensionResponse =
  | { ok: true; images: ListedImage[] }
  | { ok: true; message: string }
  | { ok: false; message: string };

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!isWholeNumber(record.tabId)) return false;
  if (record.type === "list-images") return true;
  if (record.type !== "save-image") return false;
  if (!isWholeNumber(record.imageIndex)) return false;
  return record.srcUrl === undefined || typeof record.srcUrl === "string";
}

export function isExtensionResponse(value: unknown): value is ExtensionResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.ok !== "boolean") return false;
  if (record.ok && Array.isArray(record.images)) return true;
  return typeof record.message === "string";
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

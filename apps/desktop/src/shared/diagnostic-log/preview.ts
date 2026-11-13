import { resolveItemPreviewKind } from "@swallow/shared";
import { getDiagnosticLogger } from "./logger";
import { truncateDiagnosticMessage } from "./message";
import type { DiagnosticLogFields } from "./types";

export type PreviewFailureSource =
  | "quick-look"
  | "video-preview"
  | "image-preview"
  | "font-preview"
  | "grid-thumb"
  | "list-thumb";

export type LogPreviewFailureInput = {
  source: PreviewFailureSource;
  component: string;
  itemId: string;
  ext: string;
  src?: string;
  fileSize?: number | null;
  mediaErrorCode?: number | null;
  mediaErrorMessage?: string | null;
  errorMessage?: string;
};

/** Returns the URL scheme only (never logs full library paths from `src`). */
export function previewUrlScheme(src: string | undefined): string | undefined {
  if (!src) {
    return undefined;
  }
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(src.trim());
  return match?.[1]?.toLowerCase();
}

export function logPreviewFailure(input: LogPreviewFailureInput): void {
  const mediaKind = resolveItemPreviewKind(input.ext);
  const fields: DiagnosticLogFields = {
    source: input.source,
    component: input.component,
    itemId: input.itemId,
    ext: input.ext,
    mediaType: mediaKind,
  };

  const scheme = previewUrlScheme(input.src);
  if (scheme) {
    fields.urlScheme = scheme;
  }
  if (input.fileSize != null) {
    fields.fileSize = input.fileSize;
  }
  if (input.mediaErrorCode != null) {
    fields.mediaErrorCode = input.mediaErrorCode;
  }
  if (input.mediaErrorMessage) {
    fields.mediaErrorMessage = truncateDiagnosticMessage(input.mediaErrorMessage);
  }
  if (input.errorMessage) {
    fields.errorMessage = truncateDiagnosticMessage(input.errorMessage);
  }

  getDiagnosticLogger().error("preview failed", fields);
}

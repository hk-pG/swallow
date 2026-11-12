import { THUMBNAIL_EXTS } from "../library/library";

/** Extensions served as HTML5 video in Quick Look. Mirrors `VIDEO_EXTS` in `thumbnail.rs`. */
export const VIDEO_PREVIEW_EXTS: readonly string[] = ["mp4", "webm", "mov"];

/** Extensions previewed via FontFace in Quick Look. Mirrors `FONT_EXTS` in `thumbnail.rs`. */
export const FONT_PREVIEW_EXTS: readonly string[] = ["ttf", "otf", "woff", "woff2"];

export type ItemPreviewKind = "image" | "video" | "font" | "unsupported";

export function resolveItemPreviewKind(ext: string): ItemPreviewKind {
  const lower = ext.toLowerCase();
  if (THUMBNAIL_EXTS.includes(lower)) {
    return "image";
  }
  if (VIDEO_PREVIEW_EXTS.includes(lower)) {
    return "video";
  }
  if (FONT_PREVIEW_EXTS.includes(lower)) {
    return "font";
  }
  return "unsupported";
}

/** Whether Quick Look can show native preview (not a text-only placeholder). */
export function hasQuickLookPreview(ext: string): boolean {
  return resolveItemPreviewKind(ext) !== "unsupported";
}

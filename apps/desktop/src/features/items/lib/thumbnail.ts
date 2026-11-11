import { type ItemId, THUMBNAIL_EXTS } from "@swallow/shared";
import { convertFileSrc } from "@tauri-apps/api/core";

/** Must match `THUMBNAIL_SCHEME` in `src-tauri/src/protocol.rs`. */
const THUMBNAIL_SCHEME = "thumb";

export function hasThumbnail(ext: string): boolean {
  return THUMBNAIL_EXTS.includes(ext.toLowerCase());
}

/** `<library>/images/<id>.info` */
export function itemDirPath(libraryPath: string, id: ItemId): string {
  return `${libraryPath.replace(/[\\/]+$/, "")}/images/${id}.info`;
}

export function thumbnailUrl(libraryPath: string, id: ItemId): string {
  return convertFileSrc(itemDirPath(libraryPath, id), THUMBNAIL_SCHEME);
}

/** Original stored image URL for Quick Look (`?full=1` in `protocol.rs`). */
export function originalImageUrl(libraryPath: string, id: ItemId): string {
  return `${thumbnailUrl(libraryPath, id)}?full=1`;
}

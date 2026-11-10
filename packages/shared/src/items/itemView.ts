/** Grid vs list layout for the item browser. */
export type ItemViewMode = "grid" | "list";

export const THUMBNAIL_SIZE_STEPS = [96, 120, 140, 180, 224] as const;
export const DEFAULT_THUMBNAIL_SIZE_INDEX = 2;
export const THUMBNAIL_SIZE_INDEX_MIN = 0;
export const THUMBNAIL_SIZE_INDEX_MAX = THUMBNAIL_SIZE_STEPS.length - 1;

export function clampThumbnailSizeIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_THUMBNAIL_SIZE_INDEX;
  return Math.min(THUMBNAIL_SIZE_INDEX_MAX, Math.max(THUMBNAIL_SIZE_INDEX_MIN, Math.floor(index)));
}

export function thumbnailSizePx(index: number): number {
  return THUMBNAIL_SIZE_STEPS[clampThumbnailSizeIndex(index)] as number;
}

export interface ResolvedItemViewAppearance {
  itemViewMode: ItemViewMode;
  thumbnailSizeIndex: number;
}

export function resolveItemViewAppearance(appearance: {
  itemViewMode?: ItemViewMode;
  thumbnailSizeIndex?: number;
}): ResolvedItemViewAppearance {
  return {
    itemViewMode: appearance.itemViewMode === "list" ? "list" : "grid",
    thumbnailSizeIndex: clampThumbnailSizeIndex(
      appearance.thumbnailSizeIndex ?? DEFAULT_THUMBNAIL_SIZE_INDEX,
    ),
  };
}

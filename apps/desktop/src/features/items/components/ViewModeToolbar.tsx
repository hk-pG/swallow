import {
  clampThumbnailSizeIndex,
  type ItemViewMode,
  THUMBNAIL_SIZE_INDEX_MAX,
  THUMBNAIL_SIZE_INDEX_MIN,
  THUMBNAIL_SIZE_STEPS,
  thumbnailSizePx,
} from "@swallow/shared";

export interface ViewModeToolbarProps {
  itemViewMode: ItemViewMode;
  thumbnailSizeIndex: number;
  disabled?: boolean;
  onViewModeChange: (mode: ItemViewMode) => void;
  onThumbnailSizeIndexChange: (index: number) => void;
}

export function viewModeToolbarZoomLabel(index: number): string {
  return `${thumbnailSizePx(index)}px`;
}

export function ViewModeToolbar({
  itemViewMode,
  thumbnailSizeIndex,
  disabled = false,
  onViewModeChange,
  onThumbnailSizeIndexChange,
}: ViewModeToolbarProps) {
  const sizeIndex = clampThumbnailSizeIndex(thumbnailSizeIndex);
  return (
    <fieldset className="view-mode-toolbar" disabled={disabled} aria-label="表示モード">
      <div className="view-mode-toggle">
        <button
          type="button"
          className="view-mode-button"
          aria-pressed={itemViewMode === "grid"}
          onClick={() => onViewModeChange("grid")}
        >
          グリッド
        </button>
        <button
          type="button"
          className="view-mode-button"
          aria-pressed={itemViewMode === "list"}
          onClick={() => onViewModeChange("list")}
        >
          リスト
        </button>
      </div>
      <label className="view-mode-zoom">
        <span className="view-mode-zoom-label">サムネイル</span>
        <input
          type="range"
          min={THUMBNAIL_SIZE_INDEX_MIN}
          max={THUMBNAIL_SIZE_INDEX_MAX}
          step={1}
          value={sizeIndex}
          aria-valuetext={viewModeToolbarZoomLabel(sizeIndex)}
          onChange={(e) => onThumbnailSizeIndexChange(Number(e.target.value))}
        />
        <span className="view-mode-zoom-value" aria-hidden="true">
          {THUMBNAIL_SIZE_STEPS[sizeIndex]}px
        </span>
      </label>
    </fieldset>
  );
}

import type { Folder, SmartFolderCriteria } from "@swallow/shared";
import type { Dispatch, SetStateAction } from "react";
import type { AppearanceSettingsState } from "../lib/useAppearanceSettings";
import { AdvancedSearch } from "./AdvancedSearch";
import { ViewModeToolbar } from "./ViewModeToolbar";

interface LibraryToolbarProps {
  disabled: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  searchCriteria: SmartFolderCriteria;
  onSearchCriteriaChange: Dispatch<SetStateAction<SmartFolderCriteria>>;
  onClearAdvancedSearch: () => void;
  folders: readonly Folder[];
  libraryTagNames: string[];
  appearance: AppearanceSettingsState;
  quickLookDisabled: boolean;
  onQuickLook: () => void;
  importing: boolean;
  onPickAndImport: () => void;
  onPickFoldersAndImport: () => void;
}

export function LibraryToolbar({
  disabled,
  query,
  onQueryChange,
  searchCriteria,
  onSearchCriteriaChange,
  onClearAdvancedSearch,
  folders,
  libraryTagNames,
  appearance,
  quickLookDisabled,
  onQuickLook,
  importing,
  onPickAndImport,
  onPickFoldersAndImport,
}: LibraryToolbarProps) {
  return (
    <header className="toolbar">
      <input
        className="search"
        type="search"
        placeholder="名前・タグ・注釈で検索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        disabled={disabled}
      />
      <AdvancedSearch
        criteria={searchCriteria}
        onChange={onSearchCriteriaChange}
        onClear={onClearAdvancedSearch}
        folders={folders}
        libraryTags={libraryTagNames}
        disabled={disabled}
      />
      <ViewModeToolbar
        itemViewMode={appearance.itemView.itemViewMode}
        thumbnailSizeIndex={appearance.itemView.thumbnailSizeIndex}
        disabled={disabled}
        onViewModeChange={appearance.setItemViewMode}
        onThumbnailSizeIndexChange={appearance.setThumbnailSizeIndex}
      />
      <button
        type="button"
        onClick={onQuickLook}
        disabled={disabled || quickLookDisabled}
        title="選択中のアイテムを拡大プレビュー（Space）"
      >
        クイックルック
      </button>
      <button type="button" onClick={() => void onPickAndImport()} disabled={disabled || importing}>
        {importing ? "取り込み中…" : "ファイル取り込み"}
      </button>
      <button
        type="button"
        onClick={() => void onPickFoldersAndImport()}
        disabled={disabled || importing}
      >
        フォルダ取り込み
      </button>
    </header>
  );
}

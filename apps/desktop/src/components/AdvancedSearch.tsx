import {
  EMPTY_SMART_FOLDER_CRITERIA,
  isSmartFolderCriteriaActive,
  type Folder,
  type SmartFolderCriteria,
} from "@swallow/shared";
import { useState } from "react";
import { SmartFolderCriteriaFields } from "./SmartFolderCriteriaFields";

const EXIF_NOTE =
  "EXIF（カメラ・撮影日・GPS など）は未対応です。将来のバージョンで追加予定。";

interface Props {
  criteria: SmartFolderCriteria;
  onChange: (criteria: SmartFolderCriteria) => void;
  onClear: () => void;
  folders: readonly Folder[];
  libraryTags: string[];
  disabled?: boolean;
}

export function AdvancedSearch({
  criteria,
  onChange,
  onClear,
  folders,
  libraryTags,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = isSmartFolderCriteriaActive(criteria);

  const handleClear = () => {
    onClear();
    setOpen(false);
  };

  return (
    <div className="advanced-search">
      <button
        type="button"
        className="advanced-search-toggle"
        aria-expanded={open}
        aria-controls="advanced-search-panel"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        高度検索{active ? "（適用中）" : ""}
      </button>
      {open && (
        <section
          id="advanced-search-panel"
          className="advanced-search-panel"
          aria-label="高度検索の条件"
        >
          <SmartFolderCriteriaFields
            criteria={criteria}
            folders={folders}
            libraryTags={libraryTags}
            disabled={disabled}
            onChange={onChange}
            showQueryField={false}
            datalistId="advanced-search-tag-suggestions"
            footerNote={EXIF_NOTE}
          />
          <div className="advanced-search-actions">
            <button type="button" disabled={disabled || !active} onClick={handleClear}>
              条件をクリア
            </button>
            <button type="button" disabled={disabled} onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

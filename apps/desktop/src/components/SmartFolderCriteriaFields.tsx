import type { Folder, SmartFolderCriteria, SmartFolderTagMatch } from "@swallow/shared";
import { flattenFolders } from "../lib/folders";

export interface SmartFolderCriteriaFieldsProps {
  criteria: SmartFolderCriteria;
  folders: readonly Folder[];
  libraryTags: string[];
  disabled?: boolean;
  onChange: (criteria: SmartFolderCriteria) => void;
  /** When false, hide the text query field (toolbar search covers it). */
  showQueryField?: boolean;
  /** Optional note below fields (e.g. unsupported attributes). */
  footerNote?: string;
  className?: string;
  datalistId?: string;
}

export function SmartFolderCriteriaFields({
  criteria,
  folders,
  libraryTags,
  disabled,
  onChange,
  showQueryField = true,
  footerNote,
  className = "smart-folder-criteria",
  datalistId = "smart-folder-tag-suggestions",
}: SmartFolderCriteriaFieldsProps) {
  const flatFolders = flattenFolders(folders);
  const tagsText = criteria.tags.join(", ");

  return (
    <div className={className}>
      {showQueryField && (
        <label className="smart-folder-field">
          <span>検索テキスト</span>
          <input
            className="sidebar-input"
            type="search"
            value={criteria.query}
            disabled={disabled}
            placeholder="名前・タグ・注釈"
            onChange={(e) => onChange({ ...criteria, query: e.target.value })}
          />
        </label>
      )}
      <label className="smart-folder-field">
        <span>タグ（カンマ区切り）</span>
        <input
          className="sidebar-input"
          type="text"
          list={datalistId}
          value={tagsText}
          disabled={disabled}
          onChange={(e) => {
            const tags = e.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
            onChange({ ...criteria, tags });
          }}
        />
        <datalist id={datalistId}>
          {libraryTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </label>
      <label className="smart-folder-field">
        <span>タグの一致</span>
        <select
          className="sidebar-input"
          value={criteria.tagMatch}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...criteria, tagMatch: e.target.value as SmartFolderTagMatch })
          }
        >
          <option value="all">すべて含む</option>
          <option value="any">いずれか</option>
        </select>
      </label>
      <label className="smart-folder-field">
        <span>フォルダ</span>
        <select
          className="sidebar-input"
          value={criteria.folderId ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...criteria,
              folderId: e.target.value === "" ? null : e.target.value,
            })
          }
        >
          <option value="">指定なし</option>
          {flatFolders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {"　".repeat(folder.depth) + folder.name}
            </option>
          ))}
        </select>
      </label>
      <label className="smart-folder-field">
        <span>星（以上）</span>
        <select
          className="sidebar-input"
          value={criteria.minStar === null ? "" : String(criteria.minStar)}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            onChange({
              ...criteria,
              minStar: raw === "" ? null : Number.parseInt(raw, 10),
            });
          }}
        >
          <option value="">指定なし</option>
          {Array.from({ length: 6 }, (_, star) => star).map((star) => (
            <option key={star} value={star}>
              {star === 0 ? "0（未評価のみ）" : `${star} 以上`}
            </option>
          ))}
        </select>
      </label>
      {footerNote && <p className="advanced-search-note">{footerNote}</p>}
    </div>
  );
}

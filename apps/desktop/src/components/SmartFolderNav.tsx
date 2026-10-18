import {
  EMPTY_SMART_FOLDER_CRITERIA,
  type Folder,
  type ItemView,
  type SmartFolder,
  type SmartFolderCriteria,
  type SmartFolderTagMatch,
} from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { flattenFolders } from "../lib/folders";
import type { SmartFoldersApi } from "../lib/useSmartFolders";

interface Props {
  smartFolders: SmartFolder[];
  folders: Folder[];
  libraryTags: string[];
  view: ItemView;
  onChange: (view: ItemView) => void;
  mutations: SmartFoldersApi;
  disabled?: boolean;
}

export function SmartFolderNav({
  smartFolders,
  folders,
  libraryTags,
  view,
  onChange,
  mutations,
  disabled,
}: Props) {
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [criteriaDraft, setCriteriaDraft] = useState<SmartFolderCriteria>(
    EMPTY_SMART_FOLDER_CRITERIA,
  );

  const selectedId = view.kind === "smartFolder" ? view.smartFolderId : null;
  const flatFolders = useMemo(() => flattenFolders(folders), [folders]);

  useEffect(() => {
    if (disabled) setEditorId(null);
  }, [disabled]);

  useEffect(() => {
    if (!selectedId) return;
    const folder = smartFolders.find((entry) => entry.id === selectedId);
    if (folder) {
      setCriteriaDraft(folder.criteria);
      setEditorId(folder.id);
    }
  }, [selectedId, smartFolders]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || disabled || busy) return;
    void run(async () => {
      await mutations.onCreate(name, criteriaDraft);
      setNameDraft("");
      setCriteriaDraft(EMPTY_SMART_FOLDER_CRITERIA);
    });
  };

  const saveCriteria = () => {
    if (!editorId || disabled || busy) return;
    void run(async () => {
      await mutations.onUpdateCriteria(editorId, criteriaDraft);
    });
  };

  const renameSelected = () => {
    if (!editorId || disabled || busy) return;
    const current = smartFolders.find((folder) => folder.id === editorId);
    if (!current) return;
    const next = window.prompt("スマートフォルダ名", current.name);
    if (!next) return;
    const name = next.trim();
    if (!name || name === current.name) return;
    void run(async () => {
      await mutations.onRename(editorId, name);
    });
  };

  const deleteSelected = (folder: SmartFolder) => {
    void run(async () => {
      const confirmed = await ask(`スマートフォルダ「${folder.name}」を削除しますか？`, {
        title: "スマートフォルダを削除",
        kind: "warning",
        okLabel: "削除",
        cancelLabel: "キャンセル",
      });
      if (!confirmed) return;
      await mutations.onDelete(folder.id);
      setEditorId(null);
    });
  };

  return (
    <section className="sidebar-section" aria-label="スマートフォルダ">
      <div className="sidebar-section-header">
        <h2 className="sidebar-section-title">スマートフォルダ</h2>
      </div>

      <form className="sidebar-form" onSubmit={submitCreate}>
        <input
          className="sidebar-input"
          type="text"
          placeholder="名前"
          value={nameDraft}
          disabled={disabled || busy}
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <button type="submit" disabled={disabled || busy || nameDraft.trim() === ""}>
          作成
        </button>
      </form>

      {smartFolders.length === 0 ? (
        <p className="tag-group-empty">スマートフォルダはありません</p>
      ) : (
        <nav className="smart-folder-list">
          {smartFolders.map((folder) => (
            <div key={folder.id} className="smart-folder-row">
              <button
                type="button"
                className="nav-item"
                aria-current={selectedId === folder.id ? "page" : undefined}
                disabled={disabled || busy}
                onClick={() => {
                  setEditorId(folder.id);
                  setCriteriaDraft(folder.criteria);
                  onChange({ kind: "smartFolder", smartFolderId: folder.id });
                }}
              >
                {folder.name}
              </button>
              <button
                type="button"
                className="sidebar-icon-button"
                title="削除"
                disabled={disabled || busy}
                onClick={() => deleteSelected(folder)}
              >
                ×
              </button>
            </div>
          ))}
        </nav>
      )}

      {editorId && (
        <div className="smart-folder-editor">
          <CriteriaEditor
            criteria={criteriaDraft}
            flatFolders={flatFolders}
            libraryTags={libraryTags}
            disabled={disabled || busy}
            onChange={setCriteriaDraft}
          />
          <div className="smart-folder-editor-actions">
            <button type="button" disabled={disabled || busy} onClick={renameSelected}>
              名前変更
            </button>
            <button type="button" disabled={disabled || busy} onClick={saveCriteria}>
              条件を保存
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="sidebar-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function CriteriaEditor({
  criteria,
  flatFolders,
  libraryTags,
  disabled,
  onChange,
}: {
  criteria: SmartFolderCriteria;
  flatFolders: ReturnType<typeof flattenFolders>;
  libraryTags: string[];
  disabled?: boolean;
  onChange: (criteria: SmartFolderCriteria) => void;
}) {
  const tagsText = criteria.tags.join(", ");

  return (
    <div className="smart-folder-criteria">
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
      <label className="smart-folder-field">
        <span>タグ（カンマ区切り）</span>
        <input
          className="sidebar-input"
          type="text"
          list="smart-folder-tag-suggestions"
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
        <datalist id="smart-folder-tag-suggestions">
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
    </div>
  );
}

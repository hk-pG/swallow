import {
  EMPTY_SMART_FOLDER_CRITERIA,
  type Folder,
  type ItemView,
  type SmartFolder,
  type SmartFolderCriteria,
} from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useEffect, useState } from "react";
import type { SmartFoldersApi } from "../lib/useSmartFolders";
import { SidebarSection } from "./SidebarSection";
import { SmartFolderCriteriaFields } from "./SmartFolderCriteriaFields";

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
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criteriaDraft, setCriteriaDraft] = useState<SmartFolderCriteria>(
    EMPTY_SMART_FOLDER_CRITERIA,
  );

  const selectedId = view.kind === "smartFolder" ? view.smartFolderId : null;

  useEffect(() => {
    if (disabled) setCreating(false);
  }, [disabled]);

  useEffect(() => {
    if (!selectedId) return;
    const folder = smartFolders.find((entry) => entry.id === selectedId);
    if (folder) setCriteriaDraft(folder.criteria);
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
      await mutations.onCreate(name, EMPTY_SMART_FOLDER_CRITERIA);
      setNameDraft("");
      setCreating(false);
    });
  };

  const saveCriteria = () => {
    if (!selectedId || disabled || busy) return;
    void run(async () => {
      await mutations.onUpdateCriteria(selectedId, criteriaDraft);
    });
  };

  const renameSelected = () => {
    if (!selectedId || disabled || busy) return;
    const current = smartFolders.find((folder) => folder.id === selectedId);
    if (!current) return;
    const next = window.prompt("スマートフォルダ名", current.name);
    if (!next) return;
    const name = next.trim();
    if (!name || name === current.name) return;
    void run(async () => {
      await mutations.onRename(selectedId, name);
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
    });
  };

  return (
    <SidebarSection
      title="スマートフォルダ"
      headerAction={
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          aria-expanded={creating}
          onClick={() => setCreating((open) => !open)}
        >
          追加
        </button>
      }
    >
      {creating && (
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
      )}

      {smartFolders.length === 0 ? (
        <p className="tag-group-empty">スマートフォルダはありません</p>
      ) : (
        <nav className="smart-folder-list">
          {smartFolders.map((folder) => {
            const selected = selectedId === folder.id;
            return (
              <div key={folder.id} className="sidebar-row">
                <button
                  type="button"
                  className="nav-item"
                  aria-current={selected ? "page" : undefined}
                  disabled={disabled || busy}
                  onClick={() => {
                    setCriteriaDraft(folder.criteria);
                    onChange({ kind: "smartFolder", smartFolderId: folder.id });
                  }}
                >
                  {folder.name}
                </button>
                {selected && !disabled && (
                  <div className="sidebar-detail">
                    <SmartFolderCriteriaFields
                      criteria={criteriaDraft}
                      folders={folders}
                      libraryTags={libraryTags}
                      disabled={disabled || busy}
                      onChange={setCriteriaDraft}
                      datalistId="smart-folder-tag-suggestions"
                    />
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={renameSelected}
                    >
                      名前変更
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={saveCriteria}
                    >
                      条件を保存
                    </button>
                    <button
                      type="button"
                      className="text-button danger"
                      disabled={busy}
                      onClick={() => deleteSelected(folder)}
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}

      {error && (
        <p className="sidebar-error" role="alert">
          {error}
        </p>
      )}
    </SidebarSection>
  );
}

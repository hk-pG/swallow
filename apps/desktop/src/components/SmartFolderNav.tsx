import {
  EMPTY_SMART_FOLDER_CRITERIA,
  type Folder,
  type ItemView,
  type SmartFolder,
  type SmartFolderCriteria,
} from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { useSidebarContextMenu } from "../lib/useSidebarContextMenu";
import type { SmartFoldersApi } from "../lib/useSmartFolders";
import { SidebarContextMenu } from "./SidebarContextMenu";
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

type SmartFolderMenuTarget = { folder: SmartFolder };

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
  const [criteriaEditorId, setCriteriaEditorId] = useState<string | null>(null);
  const [criteriaDraft, setCriteriaDraft] = useState<SmartFolderCriteria>(
    EMPTY_SMART_FOLDER_CRITERIA,
  );
  const {
    state: menuState,
    close: closeMenu,
    open: openMenu,
  } = useSidebarContextMenu<SmartFolderMenuTarget>();

  const selectedId = view.kind === "smartFolder" ? view.smartFolderId : null;

  useEffect(() => {
    if (disabled) setCriteriaEditorId(null);
  }, [disabled]);

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

  const openCriteriaEditor = (folder: SmartFolder) => {
    setCriteriaEditorId(folder.id);
    setCriteriaDraft(folder.criteria);
  };

  const saveCriteria = () => {
    if (!criteriaEditorId || disabled || busy) return;
    void run(async () => {
      await mutations.onUpdateCriteria(criteriaEditorId, criteriaDraft);
    });
  };

  const renameFolder = (folder: SmartFolder) => {
    if (disabled || busy) return;
    const next = window.prompt("スマートフォルダ名", folder.name);
    if (!next) return;
    const name = next.trim();
    if (!name || name === folder.name) return;
    void run(async () => {
      await mutations.onRename(folder.id, name);
    });
  };

  const deleteFolder = (folder: SmartFolder) => {
    void run(async () => {
      const confirmed = await ask(`スマートフォルダ「${folder.name}」を削除しますか？`, {
        title: "スマートフォルダを削除",
        kind: "warning",
        okLabel: "削除",
        cancelLabel: "キャンセル",
      });
      if (!confirmed) return;
      await mutations.onDelete(folder.id);
      if (criteriaEditorId === folder.id) setCriteriaEditorId(null);
    });
  };

  const menuItems = menuState
    ? [
        {
          label: "名前を変更…",
          onClick: () => renameFolder(menuState.folder),
        },
        {
          label: "条件を編集…",
          onClick: () => openCriteriaEditor(menuState.folder),
        },
        {
          label: "削除",
          danger: true,
          onClick: () => deleteFolder(menuState.folder),
        },
      ]
    : [];

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
                onClick={() => onChange({ kind: "smartFolder", smartFolderId: folder.id })}
                onContextMenu={(event: MouseEvent) => openMenu(event, { folder })}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </nav>
      )}

      {criteriaEditorId && (
        <div className="smart-folder-editor">
          <SmartFolderCriteriaFields
            criteria={criteriaDraft}
            folders={folders}
            libraryTags={libraryTags}
            disabled={disabled || busy}
            onChange={setCriteriaDraft}
            datalistId="smart-folder-tag-suggestions"
          />
          <div className="smart-folder-editor-actions">
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

      <SidebarContextMenu
        state={menuState}
        ariaLabel={menuState ? `${menuState.folder.name} の操作` : "スマートフォルダの操作"}
        items={menuItems}
        onClose={closeMenu}
      />
    </section>
  );
}

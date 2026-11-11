import type { Folder, FolderId } from "@swallow/shared";
import { useMemo, useState } from "react";
import { flattenFolderNames, flattenFolders } from "../lib/folders";

interface FolderAssignControlProps {
  folders: Folder[];
  /** Membership of one item. Omit when the same action applies to several items. */
  memberIds?: FolderId[];
  onAssign: (folderId: FolderId) => Promise<void>;
  onUnassign: (folderId: FolderId) => Promise<void>;
}

export function FolderAssignControl({
  folders,
  memberIds,
  onAssign,
  onUnassign,
}: FolderAssignControlProps) {
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(() => flattenFolderNames(folders), [folders]);
  const flat = useMemo(() => flattenFolders(folders), [folders]);
  const members = memberIds ?? [];
  const addable = memberIds ? flat.filter((folder) => !members.includes(folder.id)) : flat;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="folder-assign">
      {memberIds &&
        (members.length === 0 ? (
          flat.length > 0 && <p className="inspector-muted">未分類</p>
        ) : (
          <ul className="chip-list">
            {members.map((id) => {
              const name = names.get(id) ?? id;
              return (
                <li key={id} className="chip">
                  {name}
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`${name} から外す`}
                    onClick={() => void run(() => onUnassign(id))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
      {flat.length === 0 ? (
        <p className="inspector-muted">フォルダがありません</p>
      ) : (
        <>
          {addable.length > 0 && (
            <select
              className="inspector-input"
              aria-label="フォルダに追加"
              value=""
              onChange={(e) => {
                const folderId = e.target.value;
                if (folderId) void run(() => onAssign(folderId));
              }}
            >
              <option value="">フォルダに追加…</option>
              {addable.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"　".repeat(folder.depth) + folder.name}
                </option>
              ))}
            </select>
          )}
          {!memberIds && (
            <select
              className="inspector-input"
              aria-label="フォルダから外す"
              value=""
              onChange={(e) => {
                const folderId = e.target.value;
                if (folderId) void run(() => onUnassign(folderId));
              }}
            >
              <option value="">フォルダから外す…</option>
              {flat.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"　".repeat(folder.depth) + folder.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      {error && (
        <p className="inspector-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

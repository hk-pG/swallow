import type { Folder, FolderId } from "@swallow/shared";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { flattenFolders, moveParentOptions } from "../lib/folders";

const ROOT_VALUE = "__root__";

interface FolderTreeProps {
  folders: Folder[];
  selectedId: FolderId | null;
  disabled?: boolean;
  onSelect: (id: FolderId) => void;
  onCreate: (parentId: FolderId | null, name: string) => Promise<void>;
  onRename: (id: FolderId, name: string) => Promise<void>;
  onDelete: (id: FolderId) => Promise<void>;
  /** `index` is the position among the new siblings after this folder is removed. `null` appends. */
  onMove: (id: FolderId, parentId: FolderId | null, index: number | null) => Promise<void>;
}

type Editor = { kind: "create"; parentId: FolderId | null } | { kind: "rename"; id: FolderId };

export function FolderTree({
  folders,
  selectedId,
  disabled,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: FolderTreeProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) setEditor(null);
  }, [disabled]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      setEditor(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const creatingRoot = editor?.kind === "create" && editor.parentId === null;

  const remove = (id: FolderId) => {
    setError(null);
    void onDelete(id).catch((e: unknown) => setError(String(e)));
  };

  return (
    <section className="folder-section" aria-label="フォルダ">
      <div className="folder-header">
        <span>フォルダ</span>
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => setEditor({ kind: "create", parentId: null })}
        >
          追加
        </button>
      </div>
      {creatingRoot && (
        <FolderNameField
          initial=""
          placeholder="新しいフォルダ"
          onCommit={(name) => run(() => onCreate(null, name))}
          onCancel={() => setEditor(null)}
        />
      )}
      {folders.length === 0 && !creatingRoot ? (
        <p className="folder-empty">フォルダはありません</p>
      ) : (
        <FolderNodes
          tree={folders}
          folders={folders}
          depth={0}
          parentId={null}
          selectedId={selectedId}
          editor={editor}
          disabled={disabled}
          onSelect={onSelect}
          onEdit={setEditor}
          onCreate={(parentId, name) => run(() => onCreate(parentId, name))}
          onRename={(id, name) => run(() => onRename(id, name))}
          onDelete={remove}
          onMove={(id, parentId, index) => run(() => onMove(id, parentId, index))}
        />
      )}
      {error && (
        <p className="inspector-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

interface NodeProps {
  tree: Folder[];
  folders: Folder[];
  depth: number;
  parentId: FolderId | null;
  selectedId: FolderId | null;
  editor: Editor | null;
  disabled?: boolean;
  onSelect: (id: FolderId) => void;
  onEdit: (editor: Editor | null) => void;
  onCreate: (parentId: FolderId | null, name: string) => Promise<void>;
  onRename: (id: FolderId, name: string) => Promise<void>;
  onDelete: (id: FolderId) => void;
  onMove: (id: FolderId, parentId: FolderId | null, index: number | null) => Promise<void>;
}

function FolderNodes({
  tree,
  folders,
  depth,
  parentId,
  selectedId,
  editor,
  disabled,
  onSelect,
  onEdit,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: NodeProps) {
  return folders.map((folder, index) => {
    const selected = folder.id === selectedId;
    const renaming = editor?.kind === "rename" && editor.id === folder.id;
    const creatingChild = editor?.kind === "create" && editor.parentId === folder.id;
    return (
      <div key={folder.id} className="folder-node">
        <div className="folder-line" style={{ paddingLeft: `${depth * 12}px` }}>
          {renaming ? (
            <FolderNameField
              initial={folder.name}
              onCommit={(name) => onRename(folder.id, name)}
              onCancel={() => onEdit(null)}
            />
          ) : (
            <button
              type="button"
              className="nav-item"
              aria-current={selected ? "page" : undefined}
              disabled={disabled}
              onClick={() => onSelect(folder.id)}
            >
              {folder.name}
            </button>
          )}
        </div>
        {selected && !renaming && !disabled && (
          <div className="folder-actions" style={{ paddingLeft: `${depth * 12}px` }}>
            <button
              type="button"
              className="text-button"
              onClick={() => onEdit({ kind: "create", parentId: folder.id })}
            >
              子フォルダ
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => onEdit({ kind: "rename", id: folder.id })}
            >
              名前
            </button>
            <button
              type="button"
              className="text-button"
              disabled={index === 0}
              onClick={() => void onMove(folder.id, parentId, index - 1)}
            >
              上へ
            </button>
            <button
              type="button"
              className="text-button"
              disabled={index === folders.length - 1}
              onClick={() => void onMove(folder.id, parentId, index + 1)}
            >
              下へ
            </button>
            <MoveSelect tree={tree} folderId={folder.id} onMove={onMove} />
            <button
              type="button"
              className="text-button danger"
              onClick={() => void onDelete(folder.id)}
            >
              削除
            </button>
          </div>
        )}
        {creatingChild && (
          <div className="folder-line" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
            <FolderNameField
              initial=""
              placeholder="新しいフォルダ"
              onCommit={(name) => onCreate(folder.id, name)}
              onCancel={() => onEdit(null)}
            />
          </div>
        )}
        <FolderNodes
          tree={tree}
          folders={folder.children}
          depth={depth + 1}
          parentId={folder.id}
          selectedId={selectedId}
          editor={editor}
          disabled={disabled}
          onSelect={onSelect}
          onEdit={onEdit}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
        />
      </div>
    );
  });
}

function MoveSelect({
  tree,
  folderId,
  onMove,
}: {
  tree: Folder[];
  folderId: FolderId;
  onMove: (id: FolderId, parentId: FolderId | null, index: number | null) => Promise<void>;
}) {
  const parentId = flattenFolders(tree).find((folder) => folder.id === folderId)?.parentId ?? null;
  const options = moveParentOptions(tree, folderId);
  if (parentId === null && options.length === 0) return null;
  return (
    <select
      className="folder-move"
      aria-label="移動先"
      value=""
      onChange={(e) => {
        const value = e.target.value;
        if (value === "") return;
        void onMove(folderId, value === ROOT_VALUE ? null : value, null);
      }}
    >
      <option value="">移動…</option>
      {parentId !== null && <option value={ROOT_VALUE}>トップレベル</option>}
      {options.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {"　".repeat(folder.depth) + folder.name}
        </option>
      ))}
    </select>
  );
}

function FolderNameField({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onCommit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const cancelRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = async () => {
    if (cancelRef.current || saving) return;
    const name = value.trim();
    if (!name || name === initial.trim()) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onCommit(name);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRef.current = true;
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="inspector-input folder-name-input"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder ?? "フォルダ名"}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={onKeyDown}
    />
  );
}

import type { Folder, FolderId } from "@swallow/shared";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { flattenFolders, moveParentOptions } from "../lib/folders";
import { useSidebarContextMenu } from "../lib/useSidebarContextMenu";
import { SidebarContextMenu } from "./SidebarContextMenu";

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

type FolderMenuTarget = {
  folder: Folder;
  parentId: FolderId | null;
  siblingIndex: number;
  siblingCount: number;
};

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
  const {
    state: menuState,
    close: closeMenu,
    open: openMenu,
  } = useSidebarContextMenu<FolderMenuTarget>();

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

  const menuItems = menuState
    ? buildFolderMenuItems({
        tree: folders,
        target: menuState,
        disabled,
        onEdit: setEditor,
        onDelete: remove,
        onMove: (id, parentId, index) => run(() => onMove(id, parentId, index)),
      })
    : [];

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
          onOpenMenu={openMenu}
        />
      )}
      {error && (
        <p className="inspector-error" role="alert">
          {error}
        </p>
      )}
      <SidebarContextMenu
        state={menuState}
        ariaLabel={menuState ? `${menuState.folder.name} の操作` : "フォルダの操作"}
        items={menuItems}
        onClose={closeMenu}
      />
    </section>
  );
}

function buildFolderMenuItems({
  tree,
  target,
  disabled,
  onEdit,
  onDelete,
  onMove,
}: {
  tree: Folder[];
  target: FolderMenuTarget;
  disabled?: boolean;
  onEdit: (editor: Editor | null) => void;
  onDelete: (id: FolderId) => void;
  onMove: (id: FolderId, parentId: FolderId | null, index: number | null) => Promise<void>;
}) {
  if (disabled) return [];

  const { folder, parentId, siblingIndex, siblingCount } = target;
  const folderId = folder.id;
  const currentParentId =
    flattenFolders(tree).find((entry) => entry.id === folderId)?.parentId ?? null;
  const moveOptions = moveParentOptions(tree, folderId);

  const items: Parameters<typeof SidebarContextMenu>[0]["items"] = [
    {
      label: "子フォルダを作成…",
      onClick: () => onEdit({ kind: "create", parentId: folderId }),
    },
    {
      label: "名前を変更…",
      onClick: () => onEdit({ kind: "rename", id: folderId }),
    },
    {
      label: "上へ",
      disabled: siblingIndex === 0,
      onClick: () => void onMove(folderId, parentId, siblingIndex - 1),
    },
    {
      label: "下へ",
      disabled: siblingIndex >= siblingCount - 1,
      onClick: () => void onMove(folderId, parentId, siblingIndex + 1),
    },
  ];

  if (currentParentId !== null) {
    items.push({
      label: "トップレベルへ移動",
      onClick: () => void onMove(folderId, null, null),
    });
  }

  for (const option of moveOptions) {
    items.push({
      label: `${"　".repeat(option.depth)}${option.name} へ移動`,
      onClick: () => void onMove(folderId, option.id, null),
    });
  }

  items.push({
    label: "削除",
    danger: true,
    onClick: () => void onDelete(folderId),
  });

  return items;
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
  onOpenMenu: (event: MouseEvent, target: FolderMenuTarget) => void;
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
  onOpenMenu,
}: NodeProps) {
  return folders.map((folder, index) => {
    const selected = folder.id === selectedId;
    const renaming = editor?.kind === "rename" && editor.id === folder.id;
    const creatingChild = editor?.kind === "create" && editor.parentId === folder.id;
    return (
      <div key={folder.id} className="folder-node">
        <div className="folder-line">
          <FolderDepthGuides depth={depth} />
          {renaming ? (
            <FolderNameField
              initial={folder.name}
              onCommit={(name) => onRename(folder.id, name)}
              onCancel={() => onEdit(null)}
            />
          ) : (
            <button
              type="button"
              className="nav-item folder-nav-item"
              aria-current={selected ? "page" : undefined}
              disabled={disabled}
              onClick={() => onSelect(folder.id)}
              onContextMenu={(event) =>
                onOpenMenu(event, {
                  folder,
                  parentId,
                  siblingIndex: index,
                  siblingCount: folders.length,
                })
              }
            >
              <FolderIcon />
              <span className="folder-nav-label">{folder.name}</span>
            </button>
          )}
        </div>
        {creatingChild && (
          <div className="folder-line">
            <FolderDepthGuides depth={depth + 1} />
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
          onOpenMenu={onOpenMenu}
        />
      </div>
    );
  });
}

function FolderDepthGuides({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <span
      className="folder-depth-guides"
      style={{ "--folder-depth": depth } as CSSProperties}
      aria-hidden="true"
    />
  );
}

function FolderIcon() {
  return (
    <svg className="folder-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.17a1.5 1.5 0 0 1 1.06.44L8.88 4H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9Z"
      />
    </svg>
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

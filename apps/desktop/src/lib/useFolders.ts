import type { Folder, FolderId, ItemId, ItemView } from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  assignItems,
  createFolder,
  deleteFolder,
  listFolders,
  moveFolder,
  renameFolder,
  unassignItems,
} from "./commands";
import { flattenFolderNames } from "./folders";

export interface FoldersApi {
  folders: Folder[];
  onCreate: (parentId: FolderId | null, name: string) => Promise<void>;
  onRename: (id: FolderId, name: string) => Promise<void>;
  onDelete: (id: FolderId) => Promise<void>;
  onMove: (id: FolderId, parentId: FolderId | null, index: number | null) => Promise<void>;
  assignToFolder: (itemIds: ItemId[], folderId: FolderId) => Promise<void>;
  unassignFromFolder: (itemIds: ItemId[], folderId: FolderId) => Promise<void>;
}

interface Options {
  libraryPath: string | null;
  /** Reload the item grid after folder membership or tree changes. */
  invalidateItems: () => Promise<void>;
  setView: Dispatch<SetStateAction<ItemView>>;
}

/**
 * Folder tree state and mutations. Sidebar and inspector share this module;
 * App only mounts it and does not own folder `useState` inline.
 */
export function useFolders({ libraryPath, invalidateItems, setView }: Options): FoldersApi {
  const [folders, setFolders] = useState<Folder[]>([]);

  const folderReloadSeq = useRef(0);
  const reloadFolders = useCallback(async (): Promise<Folder[] | null> => {
    const seq = ++folderReloadSeq.current;
    if (!libraryPath) {
      setFolders([]);
      return [];
    }
    try {
      const next = await listFolders(libraryPath);
      if (seq !== folderReloadSeq.current) return null;
      setFolders(next);
      return next;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [libraryPath]);

  useEffect(() => {
    setFolders([]);
    setView((current) => (current.kind === "folder" ? { kind: "all" } : current));
    void reloadFolders();
  }, [reloadFolders, setView]);

  const refreshAfterFolderChange = async () => {
    const next = await reloadFolders();
    await invalidateItems();
    if (!next) return;
    const ids = flattenFolderNames(next);
    setView((current) =>
      current.kind === "folder" && !ids.has(current.folderId) ? { kind: "all" } : current,
    );
  };

  const requireLibrary = () => {
    if (!libraryPath) throw new Error("ライブラリが開かれていません");
    return libraryPath;
  };

  const onCreate = async (parentId: FolderId | null, name: string) => {
    const path = requireLibrary();
    const created = await createFolder(path, parentId, name);
    await refreshAfterFolderChange();
    setView({ kind: "folder", folderId: created.id });
  };

  const onRename = async (id: FolderId, name: string) => {
    await renameFolder(requireLibrary(), id, name);
    await refreshAfterFolderChange();
  };

  const onMove = async (id: FolderId, parentId: FolderId | null, index: number | null) => {
    await moveFolder(requireLibrary(), id, parentId, index);
    await refreshAfterFolderChange();
  };

  const onDelete = async (id: FolderId) => {
    const path = requireLibrary();
    const name = flattenFolderNames(folders).get(id) ?? "フォルダ";
    const confirmed = await ask(
      `「${name}」と配下のフォルダを削除します。アイテム自体は残ります。`,
      {
        title: "フォルダを削除",
        kind: "warning",
        okLabel: "削除",
        cancelLabel: "キャンセル",
      },
    );
    if (!confirmed) return;
    await deleteFolder(path, id);
    await refreshAfterFolderChange();
  };

  const changeMembership = async (
    itemIds: ItemId[],
    folderId: FolderId,
    action: typeof assignItems,
  ) => {
    if (itemIds.length === 0) return;
    await action(requireLibrary(), itemIds, folderId);
    await refreshAfterFolderChange();
  };

  return {
    folders,
    onCreate,
    onRename,
    onDelete,
    onMove,
    assignToFolder: (itemIds, folderId) => changeMembership(itemIds, folderId, assignItems),
    unassignFromFolder: (itemIds, folderId) => changeMembership(itemIds, folderId, unassignItems),
  };
}

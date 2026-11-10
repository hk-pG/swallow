import type { Folder, FolderId, ItemId } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function listFolders(libraryPath: string): Promise<Folder[]> {
  return invoke<Folder[]>("list_folders", { libraryPath });
}

/** `parentId: null` creates a top-level folder. */
export function createFolder(
  libraryPath: string,
  parentId: FolderId | null,
  name: string,
): Promise<Folder> {
  return invoke<Folder>("create_folder", { libraryPath, parentId, name });
}

export function renameFolder(libraryPath: string, id: FolderId, name: string): Promise<Folder> {
  return invoke<Folder>("rename_folder", { libraryPath, id, name });
}

/** `parentId: null` moves to the top level. `index: null` appends. */
export function moveFolder(
  libraryPath: string,
  id: FolderId,
  parentId: FolderId | null,
  index: number | null,
): Promise<Folder[]> {
  return invoke<Folder[]>("move_folder", { libraryPath, id, parentId, index });
}

/** Deletes the folder and its subfolders, and unassigns them from items. */
export function deleteFolder(libraryPath: string, id: FolderId): Promise<Folder[]> {
  return invoke<Folder[]>("delete_folder", { libraryPath, id });
}

export function assignItems(
  libraryPath: string,
  itemIds: ItemId[],
  folderId: FolderId,
): Promise<void> {
  return invoke<void>("assign_items", { libraryPath, itemIds, folderId });
}

export function unassignItems(
  libraryPath: string,
  itemIds: ItemId[],
  folderId: FolderId,
): Promise<void> {
  return invoke<void>("unassign_items", { libraryPath, itemIds, folderId });
}

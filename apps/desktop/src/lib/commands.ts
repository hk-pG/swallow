import {
  type AppInfo,
  type Folder,
  type FolderId,
  type ImportReport,
  type ItemId,
  type ItemMetadata,
  type ItemMetadataPatch,
  type LibraryInfo,
  type LibraryTags,
  type Settings,
  type SettingsPatch,
  type SmartFolder,
  type SmartFolderCriteria,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

export function getLibraryTags(libraryPath: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("get_library_tags", { libraryPath });
}

export function addTag(libraryPath: string, tag: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("add_tag", { libraryPath, tag });
}

/** Also removes the tag from every item. */
export function removeTag(libraryPath: string, tag: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("remove_tag", { libraryPath, tag });
}

export function createTagGroup(libraryPath: string, name: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("create_tag_group", { libraryPath, name });
}

/** Tags in the group stay in the library as ungrouped tags. */
export function deleteTagGroup(libraryPath: string, groupId: string): Promise<LibraryTags> {
  return invoke<LibraryTags>("delete_tag_group", { libraryPath, groupId });
}

/** `groupId: null` makes the tag ungrouped. */
export function setTagGroup(
  libraryPath: string,
  tag: string,
  groupId: string | null,
): Promise<LibraryTags> {
  return invoke<LibraryTags>("set_tag_group", { libraryPath, tag, groupId });
}

export function addItemTags(
  libraryPath: string,
  itemIds: ItemId[],
  tags: string[],
): Promise<LibraryTags> {
  return invoke<LibraryTags>("add_item_tags", { libraryPath, itemIds, tags });
}

export function removeItemTags(
  libraryPath: string,
  itemIds: ItemId[],
  tags: string[],
): Promise<void> {
  return invoke<void>("remove_item_tags", { libraryPath, itemIds, tags });
}

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

export function listSmartFolders(libraryPath: string): Promise<SmartFolder[]> {
  return invoke<SmartFolder[]>("list_smart_folders", { libraryPath });
}

export function createSmartFolder(
  libraryPath: string,
  name: string,
  criteria: SmartFolderCriteria,
): Promise<SmartFolder> {
  return invoke<SmartFolder>("create_smart_folder", { libraryPath, name, criteria });
}

export function renameSmartFolder(
  libraryPath: string,
  id: string,
  name: string,
): Promise<SmartFolder> {
  return invoke<SmartFolder>("rename_smart_folder", { libraryPath, id, name });
}

export function updateSmartFolder(
  libraryPath: string,
  id: string,
  criteria: SmartFolderCriteria,
): Promise<SmartFolder> {
  return invoke<SmartFolder>("update_smart_folder", { libraryPath, id, criteria });
}

export function deleteSmartFolder(libraryPath: string, id: string): Promise<SmartFolder[]> {
  return invoke<SmartFolder[]>("delete_smart_folder", { libraryPath, id });
}

export function unassignItems(
  libraryPath: string,
  itemIds: ItemId[],
  folderId: FolderId,
): Promise<void> {
  return invoke<void>("unassign_items", { libraryPath, itemIds, folderId });
}

/** Initializes a library in `path`, which must be missing or empty. */
export function createLibrary(path: string): Promise<LibraryInfo> {
  return invoke<LibraryInfo>("create_library", { path });
}

export function openLibrary(path: string): Promise<LibraryInfo> {
  return invoke<LibraryInfo>("open_library", { path });
}

/** The library already open, else the most recently used one; `null` if there is none. */
export function restoreLibrary(): Promise<LibraryInfo | null> {
  return invoke<LibraryInfo | null>("restore_library");
}

/** Most recently opened first. */
export function getRecentLibraries(): Promise<string[]> {
  return invoke<string[]>("recent_libraries");
}

export function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return invoke<Settings>("update_settings", { patch });
}

export function importAssets(libraryPath: string, paths: string[]): Promise<ImportReport> {
  return invoke<ImportReport>("import_assets", { libraryPath, paths });
}

/** Resolves to an empty array when the dialog is cancelled. */
export async function pickImportFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Assets", extensions: [...SUPPORTED_IMPORT_EXTENSIONS] }],
  });
  if (!selected) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

/** Resolves to an empty array when the dialog is cancelled. */
export async function pickImportFolders(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: true,
    title: "取り込むフォルダを選択",
  });
  if (!selected) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

export function listItems(libraryPath: string): Promise<ItemMetadata[]> {
  return invoke<ItemMetadata[]>("list_items", { libraryPath });
}

/** Mirrors `ITEMS_IMPORTED_EVENT` in `src-tauri/src/http_api.rs`. */
export const ITEMS_IMPORTED_EVENT = "items-imported";

/** Called for each item added through the local HTTP API (e.g. from the Chrome extension). */
export function onItemImported(handler: (item: ItemMetadata) => void): Promise<UnlistenFn> {
  return listen<ItemMetadata>(ITEMS_IMPORTED_EVENT, (event) => handler(event.payload));
}

export function getItem(libraryPath: string, id: ItemId): Promise<ItemMetadata> {
  return invoke<ItemMetadata>("get_item", { libraryPath, id });
}

export function updateItem(
  libraryPath: string,
  id: ItemId,
  patch: ItemMetadataPatch,
): Promise<ItemMetadata> {
  return invoke<ItemMetadata>("update_item", { libraryPath, id, patch });
}

/** Sets `isDeleted`; the stored files are kept until `purgeItems`. */
export function trashItems(libraryPath: string, itemIds: ItemId[]): Promise<void> {
  return invoke<void>("trash_items", { libraryPath, itemIds });
}

export function restoreItems(libraryPath: string, itemIds: ItemId[]): Promise<void> {
  return invoke<void>("restore_items", { libraryPath, itemIds });
}

/** Removes `images/<id>.info/`. Fails without removing anything unless every item is in the trash. */
export function purgeItems(libraryPath: string, itemIds: ItemId[]): Promise<void> {
  return invoke<void>("purge_items", { libraryPath, itemIds });
}

/** Opens the item file in the system file manager (Finder / Explorer / folder on Linux). */
export function revealItemInExplorer(libraryPath: string, itemId: ItemId): Promise<void> {
  return invoke<void>("reveal_item_in_explorer", { libraryPath, itemId });
}

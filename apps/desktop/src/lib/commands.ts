import {
  type AppInfo,
  type ImportReport,
  type ItemId,
  type ItemMetadata,
  type ItemMetadataPatch,
  type LibraryInfo,
  type LibraryTags,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";
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
  return selected ?? [];
}

export function listItems(libraryPath: string): Promise<ItemMetadata[]> {
  return invoke<ItemMetadata[]>("list_items", { libraryPath });
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

/** Sets `isDeleted`; the files stay in the library. Fails without changes if any id is unknown. */
export function trashItems(libraryPath: string, itemIds: ItemId[]): Promise<void> {
  return invoke<void>("trash_items", { libraryPath, itemIds });
}

import type { ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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

/** Mirrors `ITEMS_IMPORTED_EVENT` in `src-tauri/src/http_api.rs`. */
export const ITEMS_IMPORTED_EVENT = "items-imported";

/** Called for each item added through the local HTTP API (e.g. from the Chrome extension). */
export function onItemImported(handler: (item: ItemMetadata) => void): Promise<UnlistenFn> {
  return listen<ItemMetadata>(ITEMS_IMPORTED_EVENT, (event) => handler(event.payload));
}

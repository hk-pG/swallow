import type { AppInfo, ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
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

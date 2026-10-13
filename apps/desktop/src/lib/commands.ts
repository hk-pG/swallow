import type { AppInfo, ItemMetadata } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

export function listItems(libraryPath: string): Promise<ItemMetadata[]> {
  return invoke<ItemMetadata[]>("list_items", { libraryPath });
}

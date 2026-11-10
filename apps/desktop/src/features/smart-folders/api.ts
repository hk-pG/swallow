import type { SmartFolder, SmartFolderCriteria } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

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

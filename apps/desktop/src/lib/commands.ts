import { type AppInfo, type ImportReport, SUPPORTED_IMPORT_EXTENSIONS } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
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

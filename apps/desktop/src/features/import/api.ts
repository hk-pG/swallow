import type { ImportReport } from "@swallow/shared";
import { SUPPORTED_IMPORT_EXTENSIONS } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";
import { pickFiles, pickFolders } from "../../platform/dialog";

export function importAssets(libraryPath: string, paths: string[]): Promise<ImportReport> {
  return invoke<ImportReport>("import_assets", { libraryPath, paths });
}

/** Resolves to an empty array when the dialog is cancelled. */
export async function pickImportFiles(): Promise<string[]> {
  return pickFiles({
    multiple: true,
    directory: false,
    filters: [{ name: "Assets", extensions: [...SUPPORTED_IMPORT_EXTENSIONS] }],
  });
}

/** Resolves to an empty array when the dialog is cancelled. */
export async function pickImportFolders(): Promise<string[]> {
  return pickFolders({
    multiple: true,
    title: "取り込むフォルダを選択",
  });
}

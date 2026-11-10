import type { AppInfo, LibraryInfo } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
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

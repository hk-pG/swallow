import type { ItemView, SmartFolderLibrary } from "@swallow/shared";

/** Clears a smart-folder view when that definition was removed. */
export function nextViewAfterSmartFolderChange(
  view: ItemView,
  library: SmartFolderLibrary,
): ItemView {
  if (view.kind !== "smartFolder") return view;
  return library.folders.some((folder) => folder.id === view.smartFolderId)
    ? view
    : { kind: "all" };
}

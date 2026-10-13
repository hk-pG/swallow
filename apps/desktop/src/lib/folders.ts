import type { Folder, FolderId } from "@swallow/shared";

export function flattenFolderNames(
  folders: Folder[],
  out = new Map<FolderId, string>(),
): Map<FolderId, string> {
  for (const folder of folders) {
    out.set(folder.id, folder.name);
    flattenFolderNames(folder.children, out);
  }
  return out;
}

import type { Folder, FolderId } from "./library";

function find(folders: readonly Folder[], id: FolderId): Folder | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const nested = find(folder.children, id);
    if (nested) return nested;
  }
  return undefined;
}

function collect(folder: Folder, out: FolderId[]) {
  out.push(folder.id);
  for (const child of folder.children) collect(child, out);
}

/**
 * IDs of the folder and its descendants, depth-first.
 * Mirrors `subtree_ids` in `apps/desktop/src-tauri/src/folders.rs`.
 * Returns null when `id` is not in the tree.
 */
export function subtreeIds(folders: readonly Folder[], id: FolderId): FolderId[] | null {
  const folder = find(folders, id);
  if (!folder) return null;
  const ids: FolderId[] = [];
  collect(folder, ids);
  return ids;
}

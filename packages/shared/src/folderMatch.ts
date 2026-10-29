import { subtreeIds } from "./folders";
import type { Folder, FolderId, ItemMetadata } from "./library";

/**
 * Whether a non-deleted item belongs to `folderId` or a descendant when `folders` contains the tree.
 * When `folderId` is missing from `folders`, only direct membership counts.
 */
export function itemMatchesFolderSubtree(
  item: ItemMetadata,
  folderId: FolderId,
  folders: readonly Folder[],
): boolean {
  if (item.isDeleted) return false;
  const ids = subtreeIds(folders, folderId);
  if (ids === null) return item.folders.includes(folderId);
  return item.folders.some((id) => ids.includes(id));
}

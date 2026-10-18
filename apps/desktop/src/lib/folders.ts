import { type Folder, type FolderId, subtreeIds } from "@swallow/shared";

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

export interface FlatFolder {
  id: FolderId;
  name: string;
  depth: number;
  parentId: FolderId | null;
}

export function flattenFolders(
  folders: readonly Folder[],
  parentId: FolderId | null = null,
  depth = 0,
  out: FlatFolder[] = [],
): FlatFolder[] {
  for (const folder of folders) {
    out.push({ id: folder.id, name: folder.name, depth, parentId });
    flattenFolders(folder.children, folder.id, depth + 1, out);
  }
  return out;
}

/** Folders that can become a new parent of `id`: outside its subtree, and not its current parent. */
export function moveParentOptions(folders: readonly Folder[], id: FolderId): FlatFolder[] {
  const flat = flattenFolders(folders);
  const blocked = new Set(subtreeIds(folders, id) ?? [id]);
  const currentParent = flat.find((folder) => folder.id === id)?.parentId;
  return flat.filter((folder) => !blocked.has(folder.id) && folder.id !== currentParent);
}

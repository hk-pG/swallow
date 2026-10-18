import type { ColorLabel } from "./colorLabel";
import { subtreeIds } from "./folders";
import type { Folder, FolderId, ItemMetadata } from "./library";
import {
  filterItemsBySmartFolder,
  matchesSmartFolderCriteria,
  type SmartFolder,
} from "./smartFolders";

/** Minimum star (1–5) for the fixed favorites smart view. */
export const FAVORITES_MIN_STAR = 1;

export type SmartViewKind = "all" | "favorites" | "uncategorized" | "trash";

export type ItemView =
  | { kind: SmartViewKind }
  | { kind: "folder"; folderId: FolderId }
  | { kind: "tag"; tag: string }
  | { kind: "colorLabel"; colorLabel: ColorLabel | null }
  | { kind: "smartFolder"; smartFolderId: string };

/**
 * A folder view matches items in that folder and, when `folders` contains it, its descendants.
 * An id missing from `folders` matches only itself.
 */
function findSmartFolder(
  smartFolders: readonly SmartFolder[],
  id: string,
): SmartFolder | undefined {
  return smartFolders.find((folder) => folder.id === id);
}

export function matchesView(
  item: ItemMetadata,
  view: ItemView,
  folders: readonly Folder[] = [],
  smartFolders: readonly SmartFolder[] = [],
): boolean {
  switch (view.kind) {
    case "trash":
      return item.isDeleted;
    case "all":
      return !item.isDeleted;
    case "favorites":
      return !item.isDeleted && item.star >= FAVORITES_MIN_STAR;
    case "uncategorized":
      return !item.isDeleted && item.folders.length === 0;
    case "folder":
      return matchesFolder(item, view.folderId, folders);
    case "tag":
      return !item.isDeleted && item.tags.includes(view.tag);
    case "colorLabel":
      return !item.isDeleted && item.colorLabel === view.colorLabel;
    case "smartFolder": {
      const smart = findSmartFolder(smartFolders, view.smartFolderId);
      if (!smart) return false;
      return matchesSmartFolderCriteria(item, smart.criteria, folders);
    }
  }
}

function matchesFolder(
  item: ItemMetadata,
  folderId: FolderId,
  folders: readonly Folder[],
): boolean {
  if (item.isDeleted) return false;
  const ids = subtreeIds(folders, folderId);
  if (ids === null) return item.folders.includes(folderId);
  return item.folders.some((id) => ids.includes(id));
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** Splits on whitespace (including full-width spaces); every term must match. */
export function parseQuery(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

export function matchesQuery(item: ItemMetadata, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystacks = [item.name, item.annotation, ...item.tags].map(normalize);
  return terms.every((term) => haystacks.some((text) => text.includes(term)));
}

export function filterItems(
  items: readonly ItemMetadata[],
  view: ItemView,
  query: string,
  folders: readonly Folder[] = [],
  smartFolders: readonly SmartFolder[] = [],
): ItemMetadata[] {
  const terms = parseQuery(query);
  if (view.kind === "smartFolder") {
    const smart = findSmartFolder(smartFolders, view.smartFolderId);
    if (!smart) return [];
    const base = filterItemsBySmartFolder(items, smart.criteria, folders);
    if (terms.length === 0) return base;
    return base.filter((item) => matchesQuery(item, terms));
  }
  return items.filter(
    (item) => matchesView(item, view, folders, smartFolders) && matchesQuery(item, terms),
  );
}

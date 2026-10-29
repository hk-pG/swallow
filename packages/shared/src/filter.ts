import type { ColorLabel } from "./colorLabel";
import { itemMatchesFolderSubtree } from "./folderMatch";
import type { Folder, FolderId, ItemMetadata } from "./library";
import {
  EMPTY_SMART_FOLDER_CRITERIA,
  isSmartFolderCriteriaActive,
  matchesSmartFolderCriteria,
  type SmartFolder,
  type SmartFolderCriteria,
} from "./smartFolders";
import { matchesQueryTerms, parseQueryTerms } from "./textSearch";

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
      return itemMatchesFolderSubtree(item, view.folderId, folders);
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

/** Splits on whitespace (including full-width spaces); every term must match. */
export function parseQuery(query: string): string[] {
  return parseQueryTerms(query);
}

export function matchesQuery(item: ItemMetadata, terms: readonly string[]): boolean {
  return matchesQueryTerms(item, terms);
}

function matchesAdvancedCriteria(
  item: ItemMetadata,
  criteria: SmartFolderCriteria,
  folders: readonly Folder[],
): boolean {
  if (!isSmartFolderCriteriaActive(criteria)) return true;
  return matchesSmartFolderCriteria(item, criteria, folders);
}

export function filterItems(
  items: readonly ItemMetadata[],
  view: ItemView,
  query: string,
  folders: readonly Folder[] = [],
  smartFolders: readonly SmartFolder[] = [],
  searchCriteria: SmartFolderCriteria = EMPTY_SMART_FOLDER_CRITERIA,
): ItemMetadata[] {
  const terms = parseQuery(query);
  return items.filter(
    (item) =>
      matchesView(item, view, folders, smartFolders) &&
      matchesQuery(item, terms) &&
      matchesAdvancedCriteria(item, searchCriteria, folders),
  );
}

import { subtreeIds } from "./folders";
import type { Folder, FolderId, ItemMetadata } from "./library";

/** How multiple tag criteria combine. Mirrors P2 advanced search direction (#51). */
export type SmartFolderTagMatch = "all" | "any";

/** Saved filter criteria for a user-defined smart folder. */
export interface SmartFolderCriteria {
  /** Name / annotation / tags text search (same rules as toolbar search). */
  query: string;
  /** Empty = no tag filter. */
  tags: string[];
  tagMatch: SmartFolderTagMatch;
  /** When set, item must belong to this folder or a descendant. */
  folderId: FolderId | null;
  /** When set, item star must be >= this value (0–5). */
  minStar: number | null;
}

export interface SmartFolder {
  id: string;
  name: string;
  criteria: SmartFolderCriteria;
}

export interface SmartFolderLibrary {
  folders: SmartFolder[];
}

export const EMPTY_SMART_FOLDER_CRITERIA: SmartFolderCriteria = {
  query: "",
  tags: [],
  tagMatch: "all",
  folderId: null,
  minStar: null,
};

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function parseQueryTerms(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

function matchesQueryTerms(item: ItemMetadata, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystacks = [item.name, item.annotation, ...item.tags].map(normalize);
  return terms.every((term) => haystacks.some((text) => text.includes(term)));
}

function matchesFolderCriterion(
  item: ItemMetadata,
  folderId: FolderId,
  folders: readonly Folder[],
): boolean {
  if (item.isDeleted) return false;
  const ids = subtreeIds(folders, folderId);
  if (ids === null) return item.folders.includes(folderId);
  return item.folders.some((id) => ids.includes(id));
}

function matchesTagCriterion(
  item: ItemMetadata,
  tags: readonly string[],
  mode: SmartFolderTagMatch,
): boolean {
  if (tags.length === 0) return true;
  const itemTags = new Set(item.tags);
  return mode === "all"
    ? tags.every((tag) => itemTags.has(tag))
    : tags.some((tag) => itemTags.has(tag));
}

/**
 * Whether `item` matches saved criteria. Deleted items are excluded unless
 * criteria only target trash (not supported here — smart folders mirror normal views).
 */
export function matchesSmartFolderCriteria(
  item: ItemMetadata,
  criteria: SmartFolderCriteria,
  folders: readonly Folder[] = [],
): boolean {
  if (item.isDeleted) return false;
  if (!matchesQueryTerms(item, parseQueryTerms(criteria.query))) return false;
  if (!matchesTagCriterion(item, criteria.tags, criteria.tagMatch)) return false;
  if (criteria.folderId !== null && !matchesFolderCriterion(item, criteria.folderId, folders)) {
    return false;
  }
  if (criteria.minStar !== null && item.star < criteria.minStar) return false;
  return true;
}

export function filterItemsBySmartFolder(
  items: readonly ItemMetadata[],
  criteria: SmartFolderCriteria,
  folders: readonly Folder[] = [],
): ItemMetadata[] {
  return items.filter((item) => matchesSmartFolderCriteria(item, criteria, folders));
}

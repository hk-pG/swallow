import type { FolderId, ItemMetadata } from "./library";

export type SmartViewKind = "all" | "uncategorized" | "trash";

export type ItemView =
  | { kind: SmartViewKind }
  | { kind: "folder"; folderId: FolderId }
  | { kind: "tag"; tag: string };

export function matchesView(item: ItemMetadata, view: ItemView): boolean {
  switch (view.kind) {
    case "trash":
      return item.isDeleted;
    case "all":
      return !item.isDeleted;
    case "uncategorized":
      return !item.isDeleted && item.folders.length === 0;
    case "folder":
      return !item.isDeleted && item.folders.includes(view.folderId);
    case "tag":
      return !item.isDeleted && item.tags.includes(view.tag);
  }
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
): ItemMetadata[] {
  const terms = parseQuery(query);
  return items.filter((item) => matchesView(item, view) && matchesQuery(item, terms));
}

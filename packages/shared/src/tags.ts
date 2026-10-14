import type { ItemMetadata, LibraryTags } from "./library";

/** `all`: item has every selected tag. `any`: item has at least one. */
export type TagMatchMode = "all" | "any";

/** Returns every item when no tag is selected. */
export function filterItemsByTags<T extends Pick<ItemMetadata, "tags">>(
  items: readonly T[],
  selectedTags: readonly string[],
  mode: TagMatchMode = "all",
): T[] {
  if (selectedTags.length === 0) {
    return [...items];
  }
  return items.filter((item) => {
    const tags = new Set(item.tags);
    return mode === "all"
      ? selectedTags.every((tag) => tags.has(tag))
      : selectedTags.some((tag) => tags.has(tag));
  });
}

/** Tags that belong to no group, in `tags.json` order. */
export function ungroupedTags(library: LibraryTags): string[] {
  const grouped = new Set(library.groups.flatMap((group) => group.tags));
  return library.tags.filter((tag) => !grouped.has(tag));
}

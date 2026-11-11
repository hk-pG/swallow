import type { ItemView, LibraryTags, TagGroup } from "@swallow/shared";
import { ungroupedTags } from "@swallow/shared";

export interface TagSection {
  /** `null` for ungrouped tags. */
  group: TagGroup | null;
  tags: string[];
}

/** Groups first (library order), then ungrouped tags. Empty groups stay visible for management. */
export function tagSections(library: LibraryTags): TagSection[] {
  const sections: TagSection[] = library.groups.map((group) => ({
    group,
    tags: [...group.tags],
  }));
  const loose = ungroupedTags(library);
  if (loose.length > 0 || library.groups.length === 0) {
    sections.push({ group: null, tags: loose });
  }
  return sections;
}

/** Existing library tags that match `query` and are not already applied. */
export function suggestTags(
  libraryTags: readonly string[],
  query: string,
  applied: readonly string[],
  limit = 8,
): string[] {
  const appliedSet = new Set(applied);
  const needle = query.normalize("NFKC").toLowerCase().trim();
  return libraryTags
    .filter((tag) => !appliedSet.has(tag))
    .filter((tag) => needle === "" || tag.normalize("NFKC").toLowerCase().includes(needle))
    .slice(0, limit);
}

/** Clears a tag filter when that tag was removed from the library. */
export function nextViewAfterTagChange(view: ItemView, library: LibraryTags): ItemView {
  if (view.kind !== "tag") return view;
  return library.tags.includes(view.tag) ? view : { kind: "all" };
}

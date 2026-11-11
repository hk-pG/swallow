import type { ColorLabel, ItemMetadata } from "@swallow/shared";

/** Sorted unique tags across all selected items. */
export function unionItemTags(items: readonly ItemMetadata[]): string[] {
  const tags = new Set<string>();
  for (const item of items) {
    for (const tag of item.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/**
 * Shared color label when every item matches; otherwise `null` (mixed selection).
 */
export function commonColorLabel(items: readonly ItemMetadata[]): ColorLabel | null {
  const [head, ...rest] = items;
  if (!head) return null;
  const first = head.colorLabel ?? null;
  for (const item of rest) {
    if ((item.colorLabel ?? null) !== first) return null;
  }
  return first;
}

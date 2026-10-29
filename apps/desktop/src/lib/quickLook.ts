import type { ItemId, ItemMetadata } from "@swallow/shared";
import type { Selection } from "./selection";

export type QuickLookScaleMode = "fit" | "actual";

export interface QuickLookTarget {
  /** Currently previewed item. */
  item: ItemMetadata;
  /** Preview list in visible grid order (selected items when multiple, otherwise all visible items). */
  playlist: ItemMetadata[];
  /** 0-based index of `item` in `playlist`. */
  index: number;
  /** Whether `playlist` comes from a multi-selection. */
  isMultiSelection: boolean;
}

/**
 * Resolves the initial item id to open in Quick Look from the current selection.
 * Prefers the keyboard-focused item when it is selected, otherwise the first selected item
 * in visible grid order.
 */
export function initialQuickLookId(
  selection: Selection,
  visibleIds: readonly ItemId[],
): ItemId | null {
  if (selection.ids.size === 0) return null;
  if (
    selection.focus !== null &&
    selection.ids.has(selection.focus) &&
    visibleIds.includes(selection.focus)
  ) {
    return selection.focus;
  }
  return visibleIds.find((id) => selection.ids.has(id)) ?? null;
}

/**
 * Resolves the active Quick Look target and navigation playlist.
 * - Multi-selection (`selection.ids.size > 1`): navigates within selected items in visible order.
 * - Single selection (`selection.ids.size === 1`): navigates across all visible items.
 * Returns `null` if no item in the playlist remains visible.
 */
export function resolveQuickLookTarget(
  activeId: ItemId | null,
  selection: Selection,
  visibleItems: readonly ItemMetadata[],
): QuickLookTarget | null {
  if (activeId === null) return null;
  const isMultiSelection = selection.ids.size > 1;
  const playlist = isMultiSelection
    ? visibleItems.filter((item) => selection.ids.has(item.id))
    : [...visibleItems];
  if (playlist.length === 0) return null;
  const foundIndex = playlist.findIndex((item) => item.id === activeId);
  const index = Math.max(foundIndex, 0);
  const item = playlist[index];
  if (!item) return null;
  return {
    item,
    playlist,
    index,
    isMultiSelection,
  };
}

/** Moves to the previous or next item in the Quick Look playlist, clamping at the ends. */
export function stepQuickLookId(target: QuickLookTarget, direction: "prev" | "next"): ItemId {
  const nextIndex =
    direction === "prev"
      ? Math.max(0, target.index - 1)
      : Math.min(target.playlist.length - 1, target.index + 1);
  return target.playlist[nextIndex]?.id ?? target.item.id;
}

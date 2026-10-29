import type { ItemId, ItemMetadata } from "@swallow/shared";
import { type KeyboardEvent, type MouseEvent, type RefObject, useCallback, useEffect } from "react";
import { isNavigationKey, moveFocus, type SelectModifiers } from "./selection";

export interface ItemViewKeyboardOptions {
  items: ItemMetadata[];
  containerRef: RefObject<HTMLElement | null>;
  columnCount: () => number;
  onSelect: (id: ItemId, modifiers: SelectModifiers) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete?: () => void;
  onQuickLook?: (id: ItemId) => void;
  /** Extra Escape work (e.g. close a context menu) after clearing selection. */
  onEscape?: () => void;
}

export function useItemViewFocusSync(
  containerRef: RefObject<HTMLElement | null>,
  focusId: ItemId | null,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || focusId === null) return;
    const active = document.activeElement;
    if (active && active !== document.body && !container.contains(active)) return;
    const cell = container.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
    cell?.focus({ preventScroll: true });
    cell?.scrollIntoView({ block: "nearest" });
  }, [containerRef, focusId]);
}

export function useItemViewKeyboard({
  items,
  containerRef,
  columnCount,
  onSelect,
  onSelectAll,
  onClearSelection,
  onDelete,
  onQuickLook,
  onEscape,
}: ItemViewKeyboardOptions) {
  const handleClick = useCallback(
    (e: MouseEvent, id: ItemId) => {
      onSelect(id, { range: e.shiftKey, toggle: e.metaKey || e.ctrlKey });
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, id: ItemId) => {
      if (isNavigationKey(e.key)) {
        e.preventDefault();
        const order = items.map((item) => item.id);
        const next = moveFocus(order, id, e.key, columnCount());
        if (next !== null) onSelect(next, { range: e.shiftKey });
      } else if (e.key.toLowerCase() === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSelectAll();
      } else if (e.key === "Escape") {
        onClearSelection();
        onEscape?.();
      } else if (e.key === " " && onQuickLook) {
        e.preventDefault();
        onQuickLook(id);
      } else if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
        e.preventDefault();
        onDelete();
      }
    },
    [items, columnCount, onSelect, onSelectAll, onClearSelection, onDelete, onQuickLook, onEscape],
  );

  return { handleClick, handleKeyDown, containerRef };
}

export function itemViewTabStop(items: ItemMetadata[], focusId: ItemId | null): ItemId {
  const [first] = items;
  if (!first) return "";
  return items.some((item) => item.id === focusId) ? (focusId as ItemId) : first.id;
}

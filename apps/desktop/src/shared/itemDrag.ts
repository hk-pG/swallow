import type { ItemId } from "@swallow/shared";

/** Custom MIME for dragging library item ids inside the desktop webview. */
export const SWALLOW_ITEM_DRAG_MIME = "application/x-swallow-item-ids";

export function resolveDragItemIds(selectedIds: ReadonlySet<ItemId>, draggedId: ItemId): ItemId[] {
  if (selectedIds.has(draggedId)) {
    return [...selectedIds];
  }
  return [draggedId];
}

export function setItemDragData(dataTransfer: DataTransfer, itemIds: ItemId[]): void {
  dataTransfer.setData(SWALLOW_ITEM_DRAG_MIME, JSON.stringify(itemIds));
  dataTransfer.effectAllowed = "move";
}

export function isItemDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(SWALLOW_ITEM_DRAG_MIME);
}

export function readItemDragIds(dataTransfer: DataTransfer): ItemId[] | null {
  const raw = dataTransfer.getData(SWALLOW_ITEM_DRAG_MIME);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
      return null;
    }
    return parsed as ItemId[];
  } catch {
    return null;
  }
}

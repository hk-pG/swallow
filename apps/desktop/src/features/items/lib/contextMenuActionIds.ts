import type { ItemId } from "@swallow/shared";
import type { Selection } from "./selection";

/** Item ids affected by a context-menu action on `contextItemId`. */
export function contextMenuActionIds(selection: Selection, contextItemId: ItemId): ItemId[] {
  if (selection.ids.size > 1 && selection.ids.has(contextItemId)) {
    return [...selection.ids];
  }
  return [contextItemId];
}

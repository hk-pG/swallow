import type { ItemId, ItemMetadata } from "@swallow/shared";
import { type MouseEvent, useCallback, useState } from "react";
import type { Selection, SelectModifiers } from "./selection";

export interface ItemContextMenuState {
  item: ItemMetadata;
  x: number;
  y: number;
}

export interface ItemViewContextHandlers {
  isTrashView?: boolean;
  onContextTrash?: () => void;
  onContextRestore?: (id: ItemId) => void;
  onContextPurge?: (id: ItemId) => void;
  onContextEditTags?: (id: ItemId) => void;
  onContextRevealInExplorer?: (id: ItemId) => void;
}

export function itemContextMenuEnabled(handlers: ItemViewContextHandlers): boolean {
  return Boolean(
    handlers.onContextTrash ||
      handlers.onContextRestore ||
      handlers.onContextPurge ||
      handlers.onContextEditTags ||
      handlers.onContextRevealInExplorer,
  );
}

/** Opens the item context menu and selects the target when it was not already selected. */
export function useItemContextMenu(
  enabled: boolean,
  selection: Selection,
  onSelect: (id: ItemId, modifiers: SelectModifiers) => void,
) {
  const [state, setState] = useState<ItemContextMenuState | null>(null);
  const close = useCallback(() => setState(null), []);

  const handleContextMenu = useCallback(
    (e: MouseEvent, item: ItemMetadata) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (!selection.ids.has(item.id)) {
        onSelect(item.id, {});
      }
      setState({ item, x: e.clientX, y: e.clientY });
    },
    [enabled, onSelect, selection.ids],
  );

  return { state, close, handleContextMenu };
}

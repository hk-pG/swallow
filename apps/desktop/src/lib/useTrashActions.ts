import type { ItemId, ItemMetadata, ItemView } from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type Dispatch, type SetStateAction, useCallback, useMemo, useRef } from "react";
import { purgeItems, restoreItems, revealItemInExplorer, trashItems } from "./commands";
import { focusInspectorTagInput } from "./focusInspector";
import {
  EMPTY_SELECTION,
  nextAfterRemoval,
  type Selection,
  type SelectModifiers,
  select,
} from "./selection";
import { purgeConfirmMessage } from "./trash";
import type { ItemViewContextHandlers } from "./useItemContextMenu";

export interface TrashActionsApi {
  handleTrash: () => Promise<void>;
  trashSelected: () => Promise<void>;
  restoreSelected: () => Promise<void>;
  purgeSelected: () => Promise<void>;
  /** Grid/list Delete handler; omitted on the trash smart view. */
  onDelete: (() => Promise<void>) | undefined;
  contextHandlers: ItemViewContextHandlers;
  restoreItem: (itemId: ItemId) => Promise<void>;
  purgeItem: (itemId: ItemId) => Promise<void>;
  revealInExplorer: (itemId: ItemId) => Promise<void>;
  editTags: (itemId: ItemId) => void;
}

interface Options {
  libraryPath: string | null;
  view: ItemView;
  visibleIds: readonly ItemId[];
  visibleItems: readonly ItemMetadata[];
  selection: Selection;
  selected: ItemMetadata | null;
  setSelection: Dispatch<SetStateAction<Selection>>;
  clearSelection: () => void;
  onSelectItem: (id: ItemId, modifiers: SelectModifiers) => void;
  invalidate: () => Promise<void>;
  setError: (error: string | null) => void;
}

/** Trash / restore / purge / reveal / edit-tags; list refresh goes through `invalidate`. */
export function useTrashActions({
  libraryPath,
  view,
  visibleIds,
  visibleItems,
  selection,
  selected,
  setSelection,
  clearSelection,
  onSelectItem,
  invalidate,
  setError,
}: Options): TrashActionsApi {
  // Read through a ref so `handleTrash` stays stable and grid cells don't re-render on every selection change.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const handleTrash = useCallback(async () => {
    const current = selectionRef.current;
    if (!libraryPath || current.ids.size === 0) return;
    const ids = [...current.ids];
    try {
      await trashItems(libraryPath, ids);
      setError(null);
    } catch (e) {
      setError(`ゴミ箱に移動できませんでした: ${e}`);
      return;
    }
    const next = nextAfterRemoval(visibleIds, current.ids, current.focus);
    setSelection(next === null ? EMPTY_SELECTION : select(EMPTY_SELECTION, visibleIds, next));
    await invalidate();
  }, [libraryPath, visibleIds, invalidate, setError, setSelection]);

  const withSelected =
    (action: (path: string, item: ItemMetadata) => Promise<void>) => async () => {
      if (!libraryPath || !selected) throw new Error("アイテムが選択されていません");
      await action(libraryPath, selected);
    };

  const trashSelected = withSelected(async (path, item) => {
    await trashItems(path, [item.id]);
    clearSelection();
    await invalidate();
  });

  const restoreItemCore = useCallback(
    async (itemId: ItemId) => {
      if (!libraryPath) throw new Error("ライブラリが開かれていません");
      await restoreItems(libraryPath, [itemId]);
      clearSelection();
      await invalidate();
    },
    [libraryPath, clearSelection, invalidate],
  );

  const purgeItemCore = useCallback(
    async (itemId: ItemId) => {
      if (!libraryPath) throw new Error("ライブラリが開かれていません");
      const item = visibleItems.find((entry) => entry.id === itemId);
      if (!item) return;
      const confirmed = await ask(purgeConfirmMessage([item]), {
        title: "完全に削除",
        kind: "warning",
        okLabel: "完全に削除",
        cancelLabel: "キャンセル",
      });
      if (!confirmed) return;
      await purgeItems(libraryPath, [itemId]);
      clearSelection();
      await invalidate();
    },
    [libraryPath, visibleItems, clearSelection, invalidate],
  );

  const restoreSelected = withSelected(async (_path, item) => {
    await restoreItemCore(item.id);
  });

  const purgeSelected = withSelected(async (_path, item) => {
    await purgeItemCore(item.id);
  });

  const restoreItem = useCallback(
    async (itemId: ItemId) => {
      try {
        await restoreItemCore(itemId);
        setError(null);
      } catch (e) {
        setError(`復元できませんでした: ${e}`);
      }
    },
    [restoreItemCore, setError],
  );

  const purgeItem = useCallback(
    async (itemId: ItemId) => {
      try {
        await purgeItemCore(itemId);
        setError(null);
      } catch (e) {
        setError(`完全に削除できませんでした: ${e}`);
      }
    },
    [purgeItemCore, setError],
  );

  const revealInExplorer = useCallback(
    async (itemId: ItemId) => {
      if (!libraryPath) return;
      try {
        await revealItemInExplorer(libraryPath, itemId);
        setError(null);
      } catch (e) {
        setError(`エクスプローラーで表示できませんでした: ${e}`);
      }
    },
    [libraryPath, setError],
  );

  const editTags = useCallback(
    (itemId: ItemId) => {
      onSelectItem(itemId, {});
      requestAnimationFrame(() => focusInspectorTagInput());
    },
    [onSelectItem],
  );

  const isTrashView = view.kind === "trash";
  const contextHandlers = useMemo<ItemViewContextHandlers>(
    () => ({
      isTrashView,
      onContextTrash: isTrashView ? undefined : () => void handleTrash(),
      onContextRestore: isTrashView ? restoreItem : undefined,
      onContextPurge: isTrashView ? purgeItem : undefined,
      onContextEditTags: isTrashView ? undefined : editTags,
      onContextRevealInExplorer: (itemId) => void revealInExplorer(itemId),
    }),
    [isTrashView, handleTrash, restoreItem, purgeItem, editTags, revealInExplorer],
  );

  return {
    handleTrash,
    trashSelected,
    restoreSelected,
    purgeSelected,
    onDelete: isTrashView ? undefined : handleTrash,
    contextHandlers,
    restoreItem,
    purgeItem,
    revealInExplorer,
    editTags,
  };
}

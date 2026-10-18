import type { ItemId, ItemMetadata, ItemView } from "@swallow/shared";
import { ask } from "@tauri-apps/plugin-dialog";
import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";
import { purgeItems, restoreItems, trashItems } from "./commands";
import { EMPTY_SELECTION, nextAfterRemoval, type Selection, select } from "./selection";
import { purgeConfirmMessage } from "./trash";

export interface TrashActionsApi {
  handleTrash: () => Promise<void>;
  trashSelected: () => Promise<void>;
  restoreSelected: () => Promise<void>;
  purgeSelected: () => Promise<void>;
  /** Grid Delete handler; omitted on the trash smart view. */
  onDelete: (() => Promise<void>) | undefined;
}

interface Options {
  libraryPath: string | null;
  view: ItemView;
  visibleIds: readonly ItemId[];
  selection: Selection;
  selected: ItemMetadata | null;
  setSelection: Dispatch<SetStateAction<Selection>>;
  clearSelection: () => void;
  invalidate: () => Promise<void>;
  setError: (error: string | null) => void;
}

/** Trash / restore / purge; always refreshes the list via `invalidate`. */
export function useTrashActions({
  libraryPath,
  view,
  visibleIds,
  selection,
  selected,
  setSelection,
  clearSelection,
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

  const restoreSelected = withSelected(async (path, item) => {
    await restoreItems(path, [item.id]);
    clearSelection();
    await invalidate();
  });

  const purgeSelected = withSelected(async (path, item) => {
    const confirmed = await ask(purgeConfirmMessage([item]), {
      title: "完全に削除",
      kind: "warning",
      okLabel: "完全に削除",
      cancelLabel: "キャンセル",
    });
    if (!confirmed) return;
    await purgeItems(path, [item.id]);
    clearSelection();
    await invalidate();
  });

  return {
    handleTrash,
    trashSelected,
    restoreSelected,
    purgeSelected,
    onDelete: view.kind === "trash" ? undefined : handleTrash,
  };
}

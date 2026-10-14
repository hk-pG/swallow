import type { ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listItems, onItemImported, updateItem } from "./commands";
import { createItemReload } from "./itemReload";

export interface ItemList {
  items: ItemMetadata[];
  /** Reload the grid. Call after any operation that changes items; do not pass operation details. */
  invalidate: () => Promise<void>;
  saveItem: (id: ItemId, patch: ItemMetadataPatch) => Promise<void>;
}

/**
 * Library item list and its single reload entry point.
 * Import, trash, tags, folders, and inspector save all call `invalidate` without teaching this module why.
 */
export function useItemList(libraryPath: string | null): ItemList {
  const [items, setItems] = useState<ItemMetadata[]>([]);
  const reload = useMemo(() => createItemReload(listItems), []);

  const invalidate = useCallback(async () => {
    await reload(libraryPath, setItems);
  }, [libraryPath, reload]);

  useEffect(() => {
    void invalidate();
  }, [invalidate]);

  useEffect(() => {
    const unlisten = onItemImported(() => void invalidate());
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [invalidate]);

  const saveItem = useCallback(
    async (id: ItemId, patch: ItemMetadataPatch) => {
      if (!libraryPath) throw new Error("ライブラリが開かれていません");
      await updateItem(libraryPath, id, patch);
      await invalidate();
    },
    [libraryPath, invalidate],
  );

  return { items, invalidate, saveItem };
}

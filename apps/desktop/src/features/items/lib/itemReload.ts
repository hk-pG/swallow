import type { ItemMetadata } from "@swallow/shared";

/**
 * Sequential reload gate: only the latest in-flight load may publish results,
 * so a slow response for a previous library path is dropped.
 * When the path changes, stale rows are cleared before the next fetch.
 */
export function createItemReload(listItems: (path: string) => Promise<ItemMetadata[]>) {
  let seq = 0;
  let lastPath: string | null | undefined;

  return async (
    libraryPath: string | null,
    setItems: (items: ItemMetadata[]) => void,
  ): Promise<void> => {
    if (lastPath !== libraryPath) {
      lastPath = libraryPath;
      setItems([]);
    }

    const current = ++seq;
    if (!libraryPath) {
      return;
    }
    try {
      const all = await listItems(libraryPath);
      if (current === seq) setItems(all);
    } catch (e) {
      console.error(e);
    }
  };
}

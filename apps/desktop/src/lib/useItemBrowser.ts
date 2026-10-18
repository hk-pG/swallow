import {
  type Folder,
  filterItems,
  type ItemId,
  type ItemMetadata,
  type ItemView,
} from "@swallow/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  EMPTY_SELECTION,
  retainVisible,
  type Selection,
  type SelectModifiers,
  select,
  selectAll,
} from "./selection";

export interface ItemBrowser {
  view: ItemView;
  setView: Dispatch<SetStateAction<ItemView>>;
  query: string;
  setQuery: (query: string) => void;
  selection: Selection;
  setSelection: Dispatch<SetStateAction<Selection>>;
  visibleItems: ItemMetadata[];
  visibleIds: ItemId[];
  selectedCount: number;
  selected: ItemMetadata | null;
  handleSelect: (id: ItemId, modifiers: SelectModifiers) => void;
  handleSelectAll: () => void;
  clearSelection: () => void;
}

/**
 * View, search query, selection, and the derived visible list.
 * When the library session changes, `useItemList` clears `items` first so
 * `retainVisible` drops the previous selection without this hook owning the path.
 * `folders` enables descendant matching for folder views (#41).
 */
export function useItemBrowser(
  items: ItemMetadata[],
  folders: readonly Folder[] = [],
): ItemBrowser {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [view, setView] = useState<ItemView>({ kind: "all" });
  const [query, setQuery] = useState("");

  const visibleItems = useMemo(
    () => filterItems(items, view, query, folders),
    [items, view, query, folders],
  );
  const visibleIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);

  useEffect(() => setSelection((current) => retainVisible(current, visibleIds)), [visibleIds]);

  const handleSelect = useCallback(
    (id: ItemId, modifiers: SelectModifiers) =>
      setSelection((current) => select(current, visibleIds, id, modifiers)),
    [visibleIds],
  );
  const handleSelectAll = useCallback(
    () => setSelection((current) => selectAll(current, visibleIds)),
    [visibleIds],
  );
  const clearSelection = useCallback(() => setSelection(EMPTY_SELECTION), []);

  const selectedCount = selection.ids.size;
  const [selectedId] = selection.ids;
  const selected =
    selectedCount === 1 ? (items.find((item) => item.id === selectedId) ?? null) : null;

  return {
    view,
    setView,
    query,
    setQuery,
    selection,
    setSelection,
    visibleItems,
    visibleIds,
    selectedCount,
    selected,
    handleSelect,
    handleSelectAll,
    clearSelection,
  };
}

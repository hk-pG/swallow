import type { ItemId, ItemMetadata } from "@swallow/shared";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { isNavigationKey, moveFocus, type Selection, type SelectModifiers } from "../lib/selection";
import { hasThumbnail, thumbnailUrl } from "../lib/thumbnail";

interface ItemGridProps {
  libraryPath: string;
  items: ItemMetadata[];
  selection: Selection;
  onSelect: (id: ItemId, modifiers: SelectModifiers) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  /** Omit to disable the Delete key. */
  onDelete?: () => void;
  /** Space on a grid cell opens Quick Look for that item. */
  onQuickLook?: (id: ItemId) => void;
}

function columnCount(grid: HTMLElement | null): number {
  if (!grid) return 1;
  return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
}

export function ItemGrid({
  libraryPath,
  items,
  selection,
  onSelect,
  onSelectAll,
  onClearSelection,
  onDelete,
  onQuickLook,
}: ItemGridProps) {
  const gridRef = useRef<HTMLElement>(null);
  const focusId = selection.focus;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || focusId === null) return;
    const active = document.activeElement;
    // Don't pull focus out of other inputs, but recover it when the focused cell was removed.
    if (active && active !== document.body && !grid.contains(active)) return;
    const cell = grid.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
    cell?.focus({ preventScroll: true });
    cell?.scrollIntoView({ block: "nearest" });
  }, [focusId]);

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
        const next = moveFocus(order, id, e.key, columnCount(gridRef.current));
        if (next !== null) onSelect(next, { range: e.shiftKey });
      } else if (e.key.toLowerCase() === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSelectAll();
      } else if (e.key === "Escape") {
        onClearSelection();
      } else if (e.key === " " && onQuickLook) {
        e.preventDefault();
        onQuickLook(id);
      } else if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
        e.preventDefault();
        onDelete();
      }
    },
    [items, onSelect, onSelectAll, onClearSelection, onDelete, onQuickLook],
  );

  const [first] = items;
  if (!first) {
    return <section className="grid-placeholder">アイテムがありません</section>;
  }
  const tabStop = items.some((item) => item.id === focusId) ? focusId : first.id;
  return (
    <section ref={gridRef} className="grid" aria-label="アイテム一覧">
      {items.map((item) => (
        <ItemCell
          key={item.id}
          item={item}
          src={hasThumbnail(item.ext) ? thumbnailUrl(libraryPath, item.id) : null}
          selected={selection.ids.has(item.id)}
          tabStop={item.id === tabStop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
      ))}
    </section>
  );
}

interface ItemCellProps {
  item: ItemMetadata;
  src: string | null;
  selected: boolean;
  /** The one cell reachable with Tab. */
  tabStop: boolean;
  onClick: (e: MouseEvent, id: ItemId) => void;
  onKeyDown: (e: KeyboardEvent, id: ItemId) => void;
}

const ItemCell = memo(function ItemCell({
  item,
  src,
  selected,
  tabStop,
  onClick,
  onKeyDown,
}: ItemCellProps) {
  const [failed, setFailed] = useState(false);
  const fileName = `${item.name}.${item.ext}`;

  return (
    <button
      type="button"
      className="grid-item"
      data-id={item.id}
      aria-pressed={selected}
      tabIndex={tabStop ? 0 : -1}
      title={fileName}
      onClick={(e) => onClick(e, item.id)}
      onKeyDown={(e) => onKeyDown(e, item.id)}
    >
      <div className="grid-thumb">
        {src && !failed ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="grid-thumb-placeholder">{item.ext.toUpperCase() || "?"}</span>
        )}
      </div>
      <div className="grid-name">{item.name}</div>
    </button>
  );
});

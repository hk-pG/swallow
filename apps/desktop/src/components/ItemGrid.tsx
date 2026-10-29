import { COLOR_LABEL_SWATCH, type ItemId, type ItemMetadata } from "@swallow/shared";
import { type KeyboardEvent, type MouseEvent, memo, useCallback, useRef, useState } from "react";
import type { Selection, SelectModifiers } from "../lib/selection";
import { hasThumbnail, thumbnailUrl } from "../lib/thumbnail";
import {
  type ItemViewContextHandlers,
  itemContextMenuEnabled,
  useItemContextMenu,
} from "../lib/useItemContextMenu";
import {
  itemViewTabStop,
  useItemViewFocusSync,
  useItemViewKeyboard,
} from "../lib/useItemViewKeyboard";
import { ItemContextMenu } from "./ItemContextMenu";

interface ItemGridProps extends ItemViewContextHandlers {
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
  isTrashView = false,
  onContextTrash,
  onContextRestore,
  onContextPurge,
  onContextEditTags,
  onContextRevealInExplorer,
}: ItemGridProps) {
  const gridRef = useRef<HTMLElement>(null);
  const contextHandlers = {
    isTrashView,
    onContextTrash,
    onContextRestore,
    onContextPurge,
    onContextEditTags,
    onContextRevealInExplorer,
  };
  const contextMenuEnabled = itemContextMenuEnabled(contextHandlers);
  const {
    state: contextMenu,
    close: closeContextMenu,
    handleContextMenu,
  } = useItemContextMenu(contextMenuEnabled, selection, onSelect);

  const columns = useCallback(() => columnCount(gridRef.current), []);
  const { handleClick: selectClick, handleKeyDown } = useItemViewKeyboard({
    items,
    containerRef: gridRef,
    columnCount: columns,
    onSelect,
    onSelectAll,
    onClearSelection,
    onDelete,
    onQuickLook,
    onEscape: closeContextMenu,
  });
  useItemViewFocusSync(gridRef, selection.focus);

  const handleClick = useCallback(
    (e: MouseEvent, id: ItemId) => {
      closeContextMenu();
      selectClick(e, id);
    },
    [closeContextMenu, selectClick],
  );

  const [first] = items;
  if (!first) {
    return <section className="grid-placeholder">アイテムがありません</section>;
  }
  const tabStop = itemViewTabStop(items, selection.focus);
  return (
    <>
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
            onContextMenu={contextMenuEnabled ? handleContextMenu : undefined}
          />
        ))}
      </section>
      {contextMenuEnabled && (
        <ItemContextMenu
          state={contextMenu}
          isTrashView={isTrashView}
          onClose={closeContextMenu}
          onTrash={() => onContextTrash?.()}
          onRestore={(id) => onContextRestore?.(id)}
          onPurge={(id) => onContextPurge?.(id)}
          onEditTags={(id) => onContextEditTags?.(id)}
          onRevealInExplorer={(id) => onContextRevealInExplorer?.(id)}
        />
      )}
    </>
  );
}

interface ItemCellProps {
  item: ItemMetadata;
  src: string | null;
  selected: boolean;
  tabStop: boolean;
  onClick: (e: MouseEvent, id: ItemId) => void;
  onKeyDown: (e: KeyboardEvent, id: ItemId) => void;
  onContextMenu?: (e: MouseEvent, item: ItemMetadata) => void;
}

const ItemCell = memo(function ItemCell({
  item,
  src,
  selected,
  tabStop,
  onClick,
  onKeyDown,
  onContextMenu,
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
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, item) : undefined}
    >
      <div className="grid-thumb">
        {item.colorLabel ? (
          <span
            className="grid-color-label"
            style={{ background: COLOR_LABEL_SWATCH[item.colorLabel] }}
            aria-hidden="true"
            title="カラーラベル"
          />
        ) : null}
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

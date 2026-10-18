import type { ItemId, ItemMetadata } from "@swallow/shared";
import { type KeyboardEvent, type MouseEvent, memo, useCallback, useRef, useState } from "react";
import type { Selection, SelectModifiers } from "../lib/selection";
import { hasThumbnail, thumbnailUrl } from "../lib/thumbnail";
import {
  itemViewTabStop,
  useItemViewFocusSync,
  useItemViewKeyboard,
} from "../lib/useItemViewKeyboard";

interface ItemListProps {
  libraryPath: string;
  items: ItemMetadata[];
  selection: Selection;
  onSelect: (id: ItemId, modifiers: SelectModifiers) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete?: () => void;
  onQuickLook?: (id: ItemId) => void;
}

export function ItemList({
  libraryPath,
  items,
  selection,
  onSelect,
  onSelectAll,
  onClearSelection,
  onDelete,
  onQuickLook,
}: ItemListProps) {
  const listRef = useRef<HTMLElement>(null);
  const { handleClick, handleKeyDown } = useItemViewKeyboard({
    items,
    containerRef: listRef,
    columnCount: useCallback(() => 1, []),
    onSelect,
    onSelectAll,
    onClearSelection,
    onDelete,
    onQuickLook,
  });
  useItemViewFocusSync(listRef, selection.focus);
  const [first] = items;
  if (!first) return <section className="grid-placeholder">アイテムがありません</section>;
  const tabStop = itemViewTabStop(items, selection.focus);
  return (
    <section ref={listRef} className="item-list" aria-label="アイテム一覧（リスト）">
      <div className="item-list-header" aria-hidden="true">
        <span className="item-list-col-name">名前</span>
        <span className="item-list-col-star">星</span>
        <span className="item-list-col-tags">タグ</span>
      </div>
      {items.map((item) => (
        <Row
          key={item.id}
          item={item}
          libraryPath={libraryPath}
          selected={selection.ids.has(item.id)}
          tabStop={item.id === tabStop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
      ))}
    </section>
  );
}

const Row = memo(function Row({
  item,
  libraryPath,
  selected,
  tabStop,
  onClick,
  onKeyDown,
}: {
  item: ItemMetadata;
  libraryPath: string;
  selected: boolean;
  tabStop: boolean;
  onClick: (e: MouseEvent, id: ItemId) => void;
  onKeyDown: (e: KeyboardEvent, id: ItemId) => void;
}) {
  const [failed, setFailed] = useState(false);
  const src = hasThumbnail(item.ext) ? thumbnailUrl(libraryPath, item.id) : null;
  return (
    <button
      type="button"
      className="item-list-row"
      data-id={item.id}
      aria-pressed={selected}
      tabIndex={tabStop ? 0 : -1}
      onClick={(e) => onClick(e, item.id)}
      onKeyDown={(e) => onKeyDown(e, item.id)}
    >
      <span className="item-list-col-thumb">
        <span className="item-list-thumb">
          {src && !failed ? (
            <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
          ) : (
            <span className="grid-thumb-placeholder">{item.ext.toUpperCase() || "?"}</span>
          )}
        </span>
      </span>
      <span className="item-list-col-name">{item.name}</span>
      <span className="item-list-col-star">{item.star > 0 ? "★".repeat(item.star) : "—"}</span>
      <span className="item-list-col-tags">{item.tags.join(", ") || "—"}</span>
    </button>
  );
});

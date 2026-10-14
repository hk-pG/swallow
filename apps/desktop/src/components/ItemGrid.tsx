import type { ItemId, ItemMetadata } from "@swallow/shared";
import { memo, useState } from "react";
import { hasThumbnail, thumbnailUrl } from "../lib/thumbnail";

interface ItemGridProps {
  libraryPath: string;
  items: ItemMetadata[];
  selectedId: ItemId | null;
  onSelect: (id: ItemId) => void;
}

export function ItemGrid({ libraryPath, items, selectedId, onSelect }: ItemGridProps) {
  if (items.length === 0) {
    return <section className="grid-placeholder">アイテムがありません</section>;
  }
  return (
    <section className="grid">
      {items.map((item) => (
        <ItemCell
          key={item.id}
          item={item}
          src={hasThumbnail(item.ext) ? thumbnailUrl(libraryPath, item.id) : null}
          selected={item.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

interface ItemCellProps {
  item: ItemMetadata;
  src: string | null;
  selected: boolean;
  onSelect: (id: ItemId) => void;
}

const ItemCell = memo(function ItemCell({ item, src, selected, onSelect }: ItemCellProps) {
  const [failed, setFailed] = useState(false);
  const fileName = `${item.name}.${item.ext}`;

  return (
    <button
      type="button"
      className="grid-item"
      aria-pressed={selected}
      title={fileName}
      onClick={() => onSelect(item.id)}
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

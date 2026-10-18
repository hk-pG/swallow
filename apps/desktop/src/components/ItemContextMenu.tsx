import type { ItemMetadata } from "@swallow/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampContextMenuPosition } from "../lib/itemContextMenuPosition";

export interface ItemContextMenuState {
  item: ItemMetadata;
  x: number;
  y: number;
}

interface ItemContextMenuProps {
  state: ItemContextMenuState | null;
  isTrashView: boolean;
  onClose: () => void;
  onTrash: () => void;
  onRestore: (itemId: string) => void;
  onPurge: (itemId: string) => void;
  onEditTags: (itemId: string) => void;
  onRevealInExplorer: (itemId: string) => void;
}

export function ItemContextMenu({
  state,
  isTrashView,
  onClose,
  onTrash,
  onRestore,
  onPurge,
  onEditTags,
  onRevealInExplorer,
}: ItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!state || !menuRef.current) {
      setPosition(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    setPosition(clampContextMenuPosition(state.x, state.y, rect.width, rect.height));
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.contains(event.target as Node)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const style =
    position === null
      ? { visibility: "hidden" as const, left: state.x, top: state.y }
      : { left: position.x, top: position.y };

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="item-context-menu"
      role="menu"
      style={style}
      aria-label={`${state.item.name} の操作`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isTrashView || state.item.isDeleted ? (
        <>
          <MenuButton label="復元" onClick={() => run(() => onRestore(state.item.id))} />
          <MenuButton label="完全に削除" danger onClick={() => run(() => onPurge(state.item.id))} />
        </>
      ) : (
        <>
          <MenuButton label="ゴミ箱へ移動" onClick={() => run(onTrash)} />
          <MenuButton label="タグを編集…" onClick={() => run(() => onEditTags(state.item.id))} />
        </>
      )}
      <MenuButton
        label="エクスプローラーで表示"
        onClick={() => run(() => onRevealInExplorer(state.item.id))}
      />
    </div>
  );
}

function MenuButton({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? "item-context-menu-item danger" : "item-context-menu-item"}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

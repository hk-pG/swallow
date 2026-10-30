import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampContextMenuPosition } from "../lib/itemContextMenuPosition";
import type { SidebarContextMenuCoords } from "../lib/useSidebarContextMenu";

export interface SidebarContextMenuItem {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface SidebarContextMenuProps {
  state: SidebarContextMenuCoords | null;
  ariaLabel: string;
  items: SidebarContextMenuItem[];
  onClose: () => void;
}

export function SidebarContextMenu({ state, ariaLabel, items, onClose }: SidebarContextMenuProps) {
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

  const run = (item: SidebarContextMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="item-context-menu"
      role="menu"
      style={style}
      aria-label={ariaLabel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={item.danger ? "item-context-menu-item danger" : "item-context-menu-item"}
          onClick={() => run(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

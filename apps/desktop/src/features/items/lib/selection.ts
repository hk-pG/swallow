import type { ItemId } from "@swallow/shared";

export interface Selection {
  ids: ReadonlySet<ItemId>;
  /** Start of Shift ranges. */
  anchor: ItemId | null;
  /** The cell that has keyboard focus. */
  focus: ItemId | null;
}

export const EMPTY_SELECTION: Selection = { ids: new Set(), anchor: null, focus: null };

export interface SelectModifiers {
  /** Shift: select from the anchor to the target. */
  range?: boolean;
  /** Cmd / Ctrl: add to or remove from the selection. */
  toggle?: boolean;
}

/** `order` is the visible item order. */
export function select(
  selection: Selection,
  order: readonly ItemId[],
  id: ItemId,
  { range = false, toggle = false }: SelectModifiers = {},
): Selection {
  if (range) {
    const anchor =
      selection.anchor !== null && order.includes(selection.anchor) ? selection.anchor : id;
    const [a, b] = [order.indexOf(anchor), order.indexOf(id)];
    const ids = order.slice(Math.min(a, b), Math.max(a, b) + 1);
    return { ids: new Set(toggle ? [...selection.ids, ...ids] : ids), anchor, focus: id };
  }
  if (toggle) {
    const ids = new Set(selection.ids);
    if (!ids.delete(id)) ids.add(id);
    return { ids, anchor: id, focus: id };
  }
  return { ids: new Set([id]), anchor: id, focus: id };
}

export function selectAll(selection: Selection, order: readonly ItemId[]): Selection {
  return {
    ids: new Set(order),
    anchor: selection.anchor,
    focus: selection.focus ?? order[0] ?? null,
  };
}

/** Drops ids that are no longer visible. Returns `selection` itself when nothing changes. */
export function retainVisible(selection: Selection, order: readonly ItemId[]): Selection {
  const visible = new Set(order);
  const ids = [...selection.ids].filter((id) => visible.has(id));
  const anchor =
    selection.anchor !== null && visible.has(selection.anchor) ? selection.anchor : null;
  const focus = selection.focus !== null && visible.has(selection.focus) ? selection.focus : null;
  if (
    ids.length === selection.ids.size &&
    anchor === selection.anchor &&
    focus === selection.focus
  ) {
    return selection;
  }
  return { ids: new Set(ids), anchor, focus };
}

const NAVIGATION_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"] as const;
export type NavigationKey = (typeof NAVIGATION_KEYS)[number];

export function isNavigationKey(key: string): key is NavigationKey {
  return (NAVIGATION_KEYS as readonly string[]).includes(key);
}

/** The item reached from `current` in a grid of `columns` columns laid out row by row. */
export function moveFocus(
  order: readonly ItemId[],
  current: ItemId | null,
  key: NavigationKey,
  columns: number,
): ItemId | null {
  const last = order.length - 1;
  if (last < 0) return null;
  const index = current === null ? -1 : order.indexOf(current);
  if (index < 0) return order[0] ?? null;
  const cols = Math.max(1, Math.floor(columns));
  let next: number;
  switch (key) {
    case "ArrowLeft":
      next = Math.max(index - 1, 0);
      break;
    case "ArrowRight":
      next = Math.min(index + 1, last);
      break;
    case "ArrowUp":
      next = index - cols >= 0 ? index - cols : index;
      break;
    case "ArrowDown":
      // From the row above a shorter last row, land on the last item.
      next =
        Math.floor(index / cols) < Math.floor(last / cols) ? Math.min(index + cols, last) : index;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = last;
      break;
  }
  return order[next] ?? null;
}

/** The item to select after `removed` disappear: the next remaining one after `focus`, else the previous. */
export function nextAfterRemoval(
  order: readonly ItemId[],
  removed: ReadonlySet<ItemId>,
  focus: ItemId | null,
): ItemId | null {
  const index = focus === null ? -1 : order.indexOf(focus);
  if (index < 0) return null;
  const after = order.slice(index + 1).find((id) => !removed.has(id));
  if (after !== undefined) return after;
  return (
    order
      .slice(0, index)
      .reverse()
      .find((id) => !removed.has(id)) ?? null
  );
}

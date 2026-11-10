export interface MenuPosition {
  x: number;
  y: number;
}

/** Keeps a fixed-position menu inside the viewport. */
export function clampContextMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): MenuPosition {
  const margin = 8;
  const maxX = Math.max(margin, viewportWidth - menuWidth - margin);
  const maxY = Math.max(margin, viewportHeight - menuHeight - margin);
  return {
    x: Math.min(Math.max(x, margin), maxX),
    y: Math.min(Math.max(y, margin), maxY),
  };
}

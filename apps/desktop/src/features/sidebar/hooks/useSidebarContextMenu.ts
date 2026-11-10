import { type MouseEvent, useCallback, useState } from "react";

export interface SidebarContextMenuCoords {
  x: number;
  y: number;
}

export function useSidebarContextMenu<T extends Record<string, unknown>>() {
  const [state, setState] = useState<(T & SidebarContextMenuCoords) | null>(null);
  const close = useCallback(() => setState(null), []);

  const open = useCallback((event: MouseEvent, payload: T) => {
    event.preventDefault();
    event.stopPropagation();
    setState({ ...payload, x: event.clientX, y: event.clientY });
  }, []);

  return { state, close, open };
}

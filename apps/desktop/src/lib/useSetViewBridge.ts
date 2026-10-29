import type { ItemView } from "@swallow/shared";
import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";

/**
 * Forwards `setView` to a ref that App binds to `useItemBrowser` via useLayoutEffect.
 * The returned `setView` keeps a stable reference so library-sync effects in feature hooks
 * do not re-run on every parent render.
 */
export function useSetViewBridge() {
  const setViewRef = useRef<Dispatch<SetStateAction<ItemView>>>((update) => {
    void update;
  });
  const setView = useCallback((update: SetStateAction<ItemView>) => {
    setViewRef.current(update);
  }, []);
  return { setView, setViewRef };
}

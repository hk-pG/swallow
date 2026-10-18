import type { ItemId, ItemMetadata } from "@swallow/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  initialQuickLookId,
  type QuickLookScaleMode,
  resolveQuickLookTarget,
  stepQuickLookId,
} from "./quickLook";
import type { Selection } from "./selection";

export function useQuickLook(
  selection: Selection,
  visibleIds: readonly ItemId[],
  visibleItems: readonly ItemMetadata[],
) {
  const [activeId, setActiveId] = useState<ItemId | null>(null);
  const [scaleMode, setScaleMode] = useState<QuickLookScaleMode>("fit");

  const target = useMemo(
    () => (activeId === null ? null : resolveQuickLookTarget(activeId, selection, visibleItems)),
    [activeId, selection, visibleItems],
  );

  useEffect(() => {
    if (activeId !== null && target === null) {
      setActiveId(null);
    }
  }, [activeId, target]);

  const open = useCallback(() => {
    const id = initialQuickLookId(selection, visibleIds);
    if (id !== null) setActiveId(id);
  }, [selection, visibleIds]);

  const openAt = useCallback((id: ItemId) => {
    setActiveId(id);
  }, []);

  const close = useCallback(() => {
    setActiveId(null);
  }, []);

  const goPrev = useCallback(() => {
    if (target === null) return;
    setActiveId(stepQuickLookId(target, "prev"));
  }, [target]);

  const goNext = useCallback(() => {
    if (target === null) return;
    setActiveId(stepQuickLookId(target, "next"));
  }, [target]);

  const isOpen = target !== null;

  return {
    isOpen,
    target,
    scaleMode,
    setScaleMode,
    open,
    openAt,
    close,
    goPrev,
    goNext,
    canOpen: initialQuickLookId(selection, visibleIds) !== null,
  };
}

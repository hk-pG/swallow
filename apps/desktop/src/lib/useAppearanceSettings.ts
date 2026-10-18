import {
  type AppearanceSettings,
  type ResolvedItemViewAppearance,
  resolveItemViewAppearance,
} from "@swallow/shared";
import { useCallback, useEffect, useState } from "react";
import { getSettings, updateSettings } from "./commands";

export interface AppearanceSettingsState {
  itemView: ResolvedItemViewAppearance;
  setItemViewMode: (mode: ResolvedItemViewAppearance["itemViewMode"]) => void;
  setThumbnailSizeIndex: (index: number) => void;
}

export function useAppearanceSettings(): AppearanceSettingsState {
  const [itemView, setItemView] = useState<ResolvedItemViewAppearance>(() =>
    resolveItemViewAppearance({}),
  );

  useEffect(() => {
    getSettings()
      .then((settings) => setItemView(resolveItemViewAppearance(settings.appearance)))
      .catch(console.error);
  }, []);

  const persist = useCallback((patch: AppearanceSettings) => {
    updateSettings({ appearance: patch }).catch(console.error);
  }, []);

  const setItemViewMode = useCallback(
    (itemViewMode: ResolvedItemViewAppearance["itemViewMode"]) => {
      setItemView((prev) => {
        const next = resolveItemViewAppearance({ ...prev, itemViewMode });
        persist({ itemViewMode: next.itemViewMode });
        return next;
      });
    },
    [persist],
  );

  const setThumbnailSizeIndex = useCallback(
    (thumbnailSizeIndex: number) => {
      setItemView((prev) => {
        const next = resolveItemViewAppearance({ ...prev, thumbnailSizeIndex });
        persist({ thumbnailSizeIndex: next.thumbnailSizeIndex });
        return next;
      });
    },
    [persist],
  );

  return { itemView, setItemViewMode, setThumbnailSizeIndex };
}

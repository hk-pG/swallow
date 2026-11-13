import {
  type AppearanceSettings,
  type ColorScheme,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_THEME_ID,
  type ResolvedItemViewAppearance,
  resolveColorScheme,
  resolveItemViewAppearance,
  resolveThemeId,
  type ThemeId,
} from "@swallow/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { reportDiagnosticError } from "../../../shared/diagnostic-log";
import { getSettings, updateSettings } from "../api";
import { setDocumentThemeChoice } from "../lib/documentTheme";

export interface AppearanceSettingsState {
  itemView: ResolvedItemViewAppearance;
  setItemViewMode: (mode: ResolvedItemViewAppearance["itemViewMode"]) => void;
  setThumbnailSizeIndex: (index: number) => void;
  themeId: ThemeId;
  colorScheme: ColorScheme;
  setThemeId: (themeId: ThemeId) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
}

export function useAppearanceSettings(): AppearanceSettingsState {
  const [itemView, setItemView] = useState<ResolvedItemViewAppearance>(() =>
    resolveItemViewAppearance({}),
  );
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(DEFAULT_COLOR_SCHEME);
  const choiceRef = useRef({ themeId: DEFAULT_THEME_ID, colorScheme: DEFAULT_COLOR_SCHEME });

  const publishChoice = useCallback((next: { themeId: ThemeId; colorScheme: ColorScheme }) => {
    choiceRef.current = next;
    setThemeIdState(next.themeId);
    setColorSchemeState(next.colorScheme);
    setDocumentThemeChoice(next);
  }, []);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setItemView(resolveItemViewAppearance(settings.appearance));
        publishChoice({
          themeId: resolveThemeId(settings.appearance.themeId),
          colorScheme: resolveColorScheme(settings.appearance.colorScheme),
        });
      })
      .catch((e) => reportDiagnosticError("useAppearanceSettings.load", e));
  }, [publishChoice]);

  const persist = useCallback((patch: AppearanceSettings) => {
    updateSettings({ appearance: patch }).catch((e) =>
      reportDiagnosticError("useAppearanceSettings.persist", e),
    );
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

  const setThemeId = useCallback(
    (nextThemeId: ThemeId) => {
      const resolved = resolveThemeId(nextThemeId);
      publishChoice({ themeId: resolved, colorScheme: choiceRef.current.colorScheme });
      persist({ themeId: resolved });
    },
    [persist, publishChoice],
  );

  const setColorScheme = useCallback(
    (nextColorScheme: ColorScheme) => {
      const resolved = resolveColorScheme(nextColorScheme);
      publishChoice({ themeId: choiceRef.current.themeId, colorScheme: resolved });
      persist({ colorScheme: resolved });
    },
    [persist, publishChoice],
  );

  return {
    itemView,
    setItemViewMode,
    setThumbnailSizeIndex,
    themeId,
    colorScheme,
    setThemeId,
    setColorScheme,
  };
}

import type { ItemViewMode } from "../items/itemView";
import { DEFAULT_THUMBNAIL_SIZE_INDEX } from "../items/itemView";
import type { ColorScheme, ThemeId } from "./appearance";
import { DEFAULT_COLOR_SCHEME, DEFAULT_THEME_ID } from "./appearance";

/** Schema version written to `Settings.version`. */
export const SETTINGS_VERSION = 1;

export type ShortcutSettings = Record<string, never>;

export interface AppearanceSettings {
  itemViewMode?: ItemViewMode;
  thumbnailSizeIndex?: number;
  /** Catalog id. Omitted on old files; unknown ids resolve to ink when applied. */
  themeId?: ThemeId;
  /** Omitted on old files; unknown values resolve to system when applied. */
  colorScheme?: ColorScheme;
}

export type BehaviorSettings = Record<string, never>;

/** `settings.json` in the app config directory. Mirrors `Settings` in `src-tauri/src/settings.rs` (`AppearanceSettings`, etc.). */
export interface Settings {
  version: number;
  recentLibraries: string[];
  shortcuts: ShortcutSettings;
  appearance: AppearanceSettings;
  behavior: BehaviorSettings;
}

/** Partial update accepted by the `update_settings` command. */
export interface SettingsPatch {
  recentLibraries?: string[];
  shortcuts?: Partial<ShortcutSettings>;
  appearance?: Partial<AppearanceSettings>;
  behavior?: Partial<BehaviorSettings>;
}

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  recentLibraries: [],
  shortcuts: {},
  appearance: {
    itemViewMode: "grid",
    thumbnailSizeIndex: DEFAULT_THUMBNAIL_SIZE_INDEX,
    themeId: DEFAULT_THEME_ID,
    colorScheme: DEFAULT_COLOR_SCHEME,
  },
  behavior: {},
};

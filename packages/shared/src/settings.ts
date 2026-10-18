import type { ItemViewMode } from "./itemView";
import { DEFAULT_THUMBNAIL_SIZE_INDEX } from "./itemView";

/** Schema version written to `Settings.version`. */
export const SETTINGS_VERSION = 1;

export type ShortcutSettings = Record<string, never>;

export interface AppearanceSettings {
  itemViewMode?: ItemViewMode;
  thumbnailSizeIndex?: number;
}

export type BehaviorSettings = Record<string, never>;

/** `settings.json` in the app config directory. Mirrors `Settings` in `src-tauri/src/settings.rs`. */
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
  },
  behavior: {},
};

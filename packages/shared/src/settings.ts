/** Schema version written to `Settings.version`. */
export const SETTINGS_VERSION = 1;

export type ShortcutSettings = Record<string, never>;
export type AppearanceSettings = Record<string, never>;
export type BehaviorSettings = Record<string, never>;

/** `settings.json` in the app config directory. Mirrors `Settings` in `src-tauri/src/settings.rs`. */
export interface Settings {
  version: number;
  /** Most recently opened first. */
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

/** Default values for every setting. Mirrors `Settings::default()` in `src-tauri/src/settings.rs`. */
export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  recentLibraries: [],
  shortcuts: {},
  appearance: {},
  behavior: {},
};

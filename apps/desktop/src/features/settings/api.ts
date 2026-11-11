import type { Settings, SettingsPatch } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return invoke<Settings>("update_settings", { patch });
}

import type { Settings, SettingsPatch } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export interface SessionDiagnosticLog {
  text: string;
  truncated: boolean;
  maxBytes: number;
}

export function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return invoke<Settings>("update_settings", { patch });
}

export function getSessionDiagnosticLog(): Promise<SessionDiagnosticLog> {
  return invoke<SessionDiagnosticLog>("get_session_diagnostic_log");
}

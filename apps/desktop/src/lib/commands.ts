import type { AppInfo } from "@swallow/shared";
import { invoke } from "@tauri-apps/api/core";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

import { invoke } from "@tauri-apps/api/core";
import type { AppInfo } from "@torpedo/shared";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

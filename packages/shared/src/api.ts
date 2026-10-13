export const DEFAULT_API_PORT = 41600;

/** `GET /api/app/info` and the `app_info` Tauri command */
export interface AppInfo {
  name: string;
  version: string;
}

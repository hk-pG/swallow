export const DEFAULT_API_PORT = 41600;

/** Paths served by the desktop app's local HTTP API on `127.0.0.1:DEFAULT_API_PORT`. */
export const API_PATHS = {
  /** `GET` → `AppInfo` */
  appInfo: "/api/app/info",
  /**
   * `POST` with the raw file as the body → `201` and the created `ItemMetadata`.
   * See `AddItemQuery` for the query parameters.
   */
  addItem: "/api/items",
} as const;

/** Query parameters of `POST API_PATHS.addItem` */
export interface AddItemQuery {
  /** File name without extension. Defaults to `"image"` */
  name?: string;
  /** Lowercase extension without the dot. Inferred from `Content-Type` when omitted */
  ext?: string;
  /** Source page URL stored as `ItemMetadata.url` */
  url?: string;
}

/** Builds the `POST API_PATHS.addItem` path with its query string. */
export function addItemPath(query: AddItemQuery): string {
  const params = new URLSearchParams();
  for (const key of ["name", "ext", "url"] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${API_PATHS.addItem}?${search}` : API_PATHS.addItem;
}

export type ApiErrorCode =
  | "badRequest"
  | "forbidden"
  | "notFound"
  | "methodNotAllowed"
  | "payloadTooLarge"
  | "unsupportedExtension"
  | "libraryNotOpen"
  | "internal";

/** Body of every non-2xx response from the local HTTP API */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

/** `GET /api/app/info` and the `app_info` Tauri command */
export interface AppInfo {
  name: string;
  version: string;
}

/** A library opened by the desktop app */
export interface LibraryInfo {
  name: string;
  /** Absolute path of the library root */
  path: string;
}

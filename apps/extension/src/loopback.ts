import { API_PATHS, DEFAULT_API_PORT, type HttpApiRouteId, httpApiRoute } from "@swallow/shared";

/**
 * The desktop API binds 127.0.0.1 only. `localhost` may resolve to ::1 and fail to connect.
 * Paths come from `@swallow/shared` so this package does not embed route literals.
 */
export const LOOPBACK_ORIGIN = `http://127.0.0.1:${DEFAULT_API_PORT}`;

export function loopbackRouteUrl(id: HttpApiRouteId): string {
  return `${LOOPBACK_ORIGIN}${httpApiRoute(id).path}`;
}

export function desktopAppInfoUrl(): string {
  return loopbackRouteUrl("appInfo");
}

/** Path only. The save flow appends query parameters with `addItemPath` in `desktopClient.ts`. */
export function desktopAddItemPath(): string {
  return API_PATHS.addItem;
}

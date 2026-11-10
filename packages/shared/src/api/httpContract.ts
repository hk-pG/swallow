import type { ItemMetadata } from "../library/library";
import type { AddItemQuery, ApiError, AppInfo } from "./api";

export type HttpMethod = "GET" | "POST";

/** Stable ids for each desktop local HTTP API route (Chrome extension clients). */
export type HttpApiRouteId = "appInfo" | "addItem";

export interface HttpApiRouteDescriptor {
  id: HttpApiRouteId;
  method: HttpMethod;
  path: string;
  /** Exported `@swallow/shared` type name for the request body or query payload, if any. */
  requestType: string | null;
  /** Exported `@swallow/shared` type name for a successful JSON response body. */
  responseType: string;
}

/**
 * Single source of truth for the desktop app's loopback HTTP API.
 * Keep `apps/desktop/src-tauri/src/infra/http_api.rs` in sync (see `HTTP_API_ROUTE_SPECS`).
 */
export const HTTP_API_ROUTES = [
  {
    id: "appInfo",
    method: "GET",
    path: "/api/app/info",
    requestType: null,
    responseType: "AppInfo",
  },
  {
    id: "addItem",
    method: "POST",
    path: "/api/items",
    requestType: "AddItemQuery",
    responseType: "ItemMetadata",
  },
] as const satisfies readonly HttpApiRouteDescriptor[];

/** Compile-time map of route id → method, path, and payload types. */
export type HttpApiContractMap = {
  appInfo: {
    method: "GET";
    path: "/api/app/info";
    request: undefined;
    response: AppInfo;
  };
  addItem: {
    method: "POST";
    path: "/api/items";
    request: AddItemQuery;
    response: ItemMetadata;
  };
};

export type HttpApiSuccessResponse<ID extends HttpApiRouteId> = HttpApiContractMap[ID]["response"];

export type HttpApiErrorResponse = ApiError;

const routeById = Object.fromEntries(HTTP_API_ROUTES.map((route) => [route.id, route])) as Record<
  HttpApiRouteId,
  (typeof HTTP_API_ROUTES)[number]
>;

export function httpApiRoute(id: HttpApiRouteId): (typeof HTTP_API_ROUTES)[number] {
  return routeById[id];
}

import type { ItemMetadata } from "../library/library";
import type { AddItemQuery, ApiError, AppInfo } from "./api";

export type HttpMethod = "GET" | "POST";

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
] as const;

/** Stable ids for each desktop local HTTP API route (Chrome extension clients). */
export type HttpApiRouteId = (typeof HTTP_API_ROUTES)[number]["id"];

export interface HttpApiRouteDescriptor {
  id: HttpApiRouteId;
  method: HttpMethod;
  path: string;
  /** Exported `@swallow/shared` type name for the request body or query payload, if any. */
  requestType: string | null;
  /** Exported `@swallow/shared` type name for a successful JSON response body. */
  responseType: string;
}

type HttpApiContractRequestType<Name extends string | null> = Name extends "AddItemQuery"
  ? AddItemQuery
  : undefined;

type HttpApiContractResponseType<Name extends string> = Name extends "AppInfo"
  ? AppInfo
  : Name extends "ItemMetadata"
    ? ItemMetadata
    : never;

/** Compile-time map of route id → method, path, and payload types (derived from `HTTP_API_ROUTES`). */
export type HttpApiContractMap = {
  [R in (typeof HTTP_API_ROUTES)[number] as R["id"]]: {
    method: R["method"];
    path: R["path"];
    request: HttpApiContractRequestType<R["requestType"]>;
    response: HttpApiContractResponseType<R["responseType"]>;
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

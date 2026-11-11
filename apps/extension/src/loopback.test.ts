import { API_PATHS, DEFAULT_API_PORT } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { desktopAddItemPath, desktopAppInfoUrl, loopbackRouteUrl } from "./loopback";

describe("loopback", () => {
  it("targets IPv4 loopback and the shared app info route", () => {
    expect(desktopAppInfoUrl()).toBe(`http://127.0.0.1:${DEFAULT_API_PORT}${API_PATHS.appInfo}`);
    expect(loopbackRouteUrl("appInfo")).toBe(desktopAppInfoUrl());
  });

  it("uses the shared add-item path without a query string", () => {
    expect(desktopAddItemPath()).toBe(API_PATHS.addItem);
    expect(loopbackRouteUrl("addItem")).toBe(
      `http://127.0.0.1:${DEFAULT_API_PORT}${API_PATHS.addItem}`,
    );
  });
});

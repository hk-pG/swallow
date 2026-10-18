import type { Settings } from "@swallow/shared";
import { DEFAULT_SETTINGS } from "@swallow/shared";
import { describe, expect, it } from "vitest";

describe("settings command types", () => {
  it("DEFAULT_SETTINGS matches the backend schema shape", () => {
    const settings: Settings = DEFAULT_SETTINGS;
    expect(settings).toEqual({
      version: 1,
      recentLibraries: [],
      shortcuts: {},
      appearance: {},
      behavior: {},
    });
  });
});

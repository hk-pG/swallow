import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "./settings";

describe("DEFAULT_SETTINGS", () => {
  it("matches the current schema version and empty sections", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      version: SETTINGS_VERSION,
      recentLibraries: [],
      shortcuts: {},
      appearance: { itemViewMode: "grid", thumbnailSizeIndex: 2 },
      behavior: {},
    });
  });
});

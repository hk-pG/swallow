import { describe, expect, it } from "vitest";
import { APP_FEATURE_PROVIDERS, assertUniqueAppFeatureProviderIds } from "./appFeatureProviders";
import { sidebarSections } from "./sidebarRegistry";

describe("APP_FEATURE_PROVIDERS", () => {
  it("lists unique provider ids", () => {
    const ids = APP_FEATURE_PROVIDERS.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => assertUniqueAppFeatureProviderIds(APP_FEATURE_PROVIDERS)).not.toThrow();
  });

  it("rejects duplicate provider ids", () => {
    expect(() => assertUniqueAppFeatureProviderIds([{ id: "folders" }, { id: "folders" }])).toThrow(
      /duplicate id "folders"/,
    );
  });

  it("satisfies every sidebar section requiredProviders declaration", () => {
    const registered = new Set(APP_FEATURE_PROVIDERS.map((spec) => spec.id));
    for (const entry of sidebarSections) {
      for (const providerId of entry.requiredProviders) {
        expect(registered.has(providerId), `${entry.id} needs ${providerId}`).toBe(true);
      }
    }
  });

  it("pulls values from useAppSession fields with matching names", () => {
    const sessionKeys = new Set(["folders", "smartFolders", "tags"]);
    for (const spec of APP_FEATURE_PROVIDERS) {
      if (spec.id === "smart-folders") {
        expect(sessionKeys.has("smartFolders")).toBe(true);
        continue;
      }
      expect(sessionKeys.has(spec.id)).toBe(true);
    }
  });
});

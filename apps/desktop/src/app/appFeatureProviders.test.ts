import { describe, expect, it } from "vitest";
import { APP_FEATURE_PROVIDERS, assertUniqueAppFeatureProviderIds } from "./appFeatureProviders";

/** Sidebar sections that call context hooks — must stay aligned with APP_FEATURE_PROVIDERS. */
const SIDEBAR_CONTEXT_REQUIREMENTS: Record<string, readonly string[]> = {
  "smart-folders": ["folders", "smart-folders", "tags"],
  folders: ["folders"],
  tags: ["tags"],
};

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

  it("covers every sidebar section that uses feature context hooks", () => {
    const registered = new Set(APP_FEATURE_PROVIDERS.map((spec) => spec.id));
    for (const [sectionId, required] of Object.entries(SIDEBAR_CONTEXT_REQUIREMENTS)) {
      for (const providerId of required) {
        expect(registered.has(providerId), `${sectionId} needs ${providerId}`).toBe(true);
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

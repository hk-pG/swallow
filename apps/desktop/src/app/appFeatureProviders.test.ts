import { describe, expect, it } from "vitest";
import { APP_FEATURE_PROVIDERS, assertUniqueAppFeatureProviderIds } from "./appFeatureProviders";
import { sidebarSections } from "./sidebarRegistry";
import type { AppSession } from "./useAppSession";

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

  it("pulls catalog values from the browser session slice", () => {
    const browserFieldByProviderId: Record<string, keyof AppSession["browser"]> = {
      folders: "folders",
      "smart-folders": "smartFolders",
      tags: "tags",
    };
    for (const spec of APP_FEATURE_PROVIDERS) {
      expect(browserFieldByProviderId[spec.id]).toBeDefined();
    }
  });
});

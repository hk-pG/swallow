import { describe, expect, it } from "vitest";
import { assertValidSidebarRegistry } from "./assertValidSidebarRegistry";
import type { AppSidebarSectionEntry } from "./sidebarRegistryTypes";

function StubSidebarSection() {
  return null;
}

function stubSection(
  id: string,
  requiredProviders: AppSidebarSectionEntry["requiredProviders"] = [],
): AppSidebarSectionEntry {
  return { id, Component: StubSidebarSection, requiredProviders };
}

describe("assertValidSidebarRegistry", () => {
  it("accepts the production registry shape", () => {
    expect(() =>
      assertValidSidebarRegistry([
        stubSection("smart-views"),
        stubSection("smart-folders", ["folders", "smart-folders", "tags"]),
        stubSection("folders", ["folders"]),
        stubSection("color-labels"),
        stubSection("tags", ["tags"]),
      ]),
    ).not.toThrow();
  });

  it("rejects an empty registry", () => {
    expect(() => assertValidSidebarRegistry([])).toThrow(/at least one section/);
  });

  it("rejects blank ids", () => {
    expect(() => assertValidSidebarRegistry([stubSection("   ")])).toThrow(/non-empty id/);
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      assertValidSidebarRegistry([stubSection("folders"), stubSection("folders")]),
    ).toThrow(/duplicate id "folders"/);
  });

  it("rejects entries without a Component", () => {
    expect(() =>
      assertValidSidebarRegistry([
        {
          id: "broken",
          Component: null as unknown as () => null,
          requiredProviders: [],
        },
      ]),
    ).toThrow(/mountable Component/);
  });

  it("rejects unknown requiredProviders ids", () => {
    expect(() =>
      assertValidSidebarRegistry([
        stubSection("broken", ["not-a-provider" as AppSidebarSectionEntry["requiredProviders"][0]]),
      ]),
    ).toThrow(/unknown provider/);
  });

  it("rejects duplicate requiredProviders on one entry", () => {
    expect(() =>
      assertValidSidebarRegistry([stubSection("folders", ["folders", "folders"])]),
    ).toThrow(/duplicate requiredProviders/);
  });
});

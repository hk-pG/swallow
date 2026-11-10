import { describe, expect, it } from "vitest";
import type { SidebarSectionEntry } from "../features/sidebar";
import { assertValidSidebarRegistry } from "./assertValidSidebarRegistry";

function StubSidebarSection() {
  return null;
}

function stubSection(id: string): SidebarSectionEntry {
  return { id, Component: StubSidebarSection };
}

describe("assertValidSidebarRegistry", () => {
  it("accepts the production registry shape", () => {
    expect(() =>
      assertValidSidebarRegistry([
        stubSection("smart-views"),
        stubSection("smart-folders"),
        stubSection("folders"),
        stubSection("color-labels"),
        stubSection("tags"),
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
      assertValidSidebarRegistry([{ id: "broken", Component: null as unknown as () => null }]),
    ).toThrow(/mountable Component/);
  });
});

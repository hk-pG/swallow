import { describe, expect, it } from "vitest";
import { assertValidSidebarRegistry } from "./assertValidSidebarRegistry";
import { sidebarSections } from "./sidebarRegistry";

describe("sidebarSections", () => {
  it("registers smart views, folders, color labels, then tags", () => {
    expect(sidebarSections.map((entry) => entry.id)).toEqual([
      "smart-views",
      "smart-folders",
      "folders",
      "color-labels",
      "tags",
    ]);
  });

  it("passes registry invariants", () => {
    expect(() => assertValidSidebarRegistry(sidebarSections)).not.toThrow();
  });

  it("exposes a stable id on every entry so sections can be appended without touching App", () => {
    for (const entry of sidebarSections) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.Component).toBe("function");
    }
  });
});

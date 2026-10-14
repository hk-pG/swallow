import { describe, expect, it } from "vitest";
import { sidebarSections } from "./sections";

describe("sidebarSections", () => {
  it("registers smart views as the first section", () => {
    expect(sidebarSections[0]?.id).toBe("smart-views");
  });

  it("exposes a stable id on every entry so sections can be appended without touching App", () => {
    for (const entry of sidebarSections) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.Component).toBe("function");
    }
  });
});

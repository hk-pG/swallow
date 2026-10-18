import { describe, expect, it } from "vitest";
import { sidebarSections } from "./sections";

describe("sidebarSections", () => {
  it("registers smart views then folders", () => {
    expect(sidebarSections.map((entry) => entry.id)).toEqual(["smart-views", "folders"]);
  });

  it("exposes a stable id on every entry so sections can be appended without touching App", () => {
    for (const entry of sidebarSections) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.Component).toBe("function");
    }
  });
});

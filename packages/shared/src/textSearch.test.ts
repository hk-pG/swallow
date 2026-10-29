import { describe, expect, it } from "vitest";
import type { ItemMetadata } from "./library";
import { matchesQueryTerms, parseQueryTerms } from "./textSearch";

const filed: ItemMetadata = {
  id: "filed",
  name: "Sunset Beach",
  ext: "png",
  size: 0,
  width: null,
  height: null,
  tags: ["landscape"],
  folders: ["f1"],
  annotation: "",
  star: 0,
  colorLabel: null,
  url: null,
  createdAt: 0,
  modifiedAt: 0,
  isDeleted: false,
};

describe("parseQueryTerms", () => {
  it("splits on half- and full-width spaces and drops empties", () => {
    expect(parseQueryTerms("  Foo　bar  ")).toEqual(["foo", "bar"]);
    expect(parseQueryTerms("   ")).toEqual([]);
  });

  it("normalizes full-width characters", () => {
    expect(parseQueryTerms("ＬＯＧＯ")).toEqual(["logo"]);
  });
});

describe("matchesQueryTerms", () => {
  it("requires every term to match name, tags, or annotation", () => {
    expect(matchesQueryTerms(filed, parseQueryTerms("beach landscape"))).toBe(true);
    expect(matchesQueryTerms(filed, parseQueryTerms("beach logo"))).toBe(false);
    expect(matchesQueryTerms(filed, [])).toBe(true);
  });
});

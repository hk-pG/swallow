import { describe, expect, it } from "vitest";
import { filterItemsByTags, ungroupedTags } from "./tags";

const items = [
  { id: "a", tags: ["cat", "red"] },
  { id: "b", tags: ["dog", "red"] },
  { id: "c", tags: [] },
];

describe("filterItemsByTags", () => {
  it("returns every item when no tag is selected", () => {
    expect(filterItemsByTags(items, [])).toEqual(items);
  });

  it("requires every selected tag by default", () => {
    expect(filterItemsByTags(items, ["cat", "red"]).map((i) => i.id)).toEqual(["a"]);
  });

  it("matches any selected tag in any mode", () => {
    expect(filterItemsByTags(items, ["cat", "dog"], "any").map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("ungroupedTags", () => {
  it("excludes tags that belong to a group", () => {
    expect(
      ungroupedTags({
        tags: ["cat", "dog", "red"],
        groups: [{ id: "g", name: "Animals", tags: ["cat", "dog"] }],
      }),
    ).toEqual(["red"]);
  });
});

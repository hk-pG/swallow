import type { ItemView, LibraryTags } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { nextViewAfterTagChange, suggestTags, tagSections } from "./tags";

const library: LibraryTags = {
  tags: ["cat", "dog", "red", "blue"],
  groups: [
    { id: "animals", name: "Animals", tags: ["cat", "dog"] },
    { id: "empty", name: "Empty", tags: [] },
  ],
};

describe("tagSections", () => {
  it("lists groups then ungrouped tags", () => {
    expect(tagSections(library)).toEqual([
      { group: library.groups[0], tags: ["cat", "dog"] },
      { group: library.groups[1], tags: [] },
      { group: null, tags: ["red", "blue"] },
    ]);
  });

  it("keeps an ungrouped section when there are no groups", () => {
    expect(tagSections({ tags: ["solo"], groups: [] })).toEqual([{ group: null, tags: ["solo"] }]);
  });
});

describe("suggestTags", () => {
  it("filters by query and excludes applied tags", () => {
    expect(suggestTags(["cat", "dog", "red"], "d", ["dog"])).toEqual(["red"]);
  });

  it("returns unapplied tags when the query is empty", () => {
    expect(suggestTags(["cat", "dog"], "", ["cat"])).toEqual(["dog"]);
  });
});

describe("nextViewAfterTagChange", () => {
  it("keeps non-tag views", () => {
    const view: ItemView = { kind: "trash" };
    expect(nextViewAfterTagChange(view, library)).toEqual(view);
  });

  it("keeps a tag view when the tag still exists", () => {
    expect(nextViewAfterTagChange({ kind: "tag", tag: "cat" }, library)).toEqual({
      kind: "tag",
      tag: "cat",
    });
  });

  it("resets to all when the filtered tag was removed", () => {
    expect(nextViewAfterTagChange({ kind: "tag", tag: "gone" }, library)).toEqual({
      kind: "all",
    });
  });
});

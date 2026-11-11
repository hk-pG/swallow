import type { ItemMetadata } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { commonColorLabel, unionItemTags } from "./multiSelect";

function item(partial: Partial<ItemMetadata> & Pick<ItemMetadata, "id">): ItemMetadata {
  return {
    name: "n",
    ext: "png",
    size: 1,
    width: null,
    height: null,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    colorLabel: null,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
    ...partial,
  };
}

describe("unionItemTags", () => {
  it("merges tags from every selected item", () => {
    expect(
      unionItemTags([item({ id: "a", tags: ["b", "a"] }), item({ id: "b", tags: ["c"] })]),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("commonColorLabel", () => {
  it("returns the label when all items share it", () => {
    expect(
      commonColorLabel([
        item({ id: "a", colorLabel: "red" }),
        item({ id: "b", colorLabel: "red" }),
      ]),
    ).toBe("red");
  });

  it("returns null for mixed labels", () => {
    expect(
      commonColorLabel([
        item({ id: "a", colorLabel: "red" }),
        item({ id: "b", colorLabel: "blue" }),
      ]),
    ).toBeNull();
  });
});

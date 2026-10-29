import { describe, expect, it } from "vitest";
import { itemMatchesFolderSubtree } from "./folderMatch";
import type { Folder, ItemMetadata } from "./library";

function item(overrides: Partial<ItemMetadata> & Pick<ItemMetadata, "id">): ItemMetadata {
  return {
    name: overrides.id,
    ext: "png",
    size: 0,
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
    ...overrides,
  };
}

const tree: Folder[] = [
  { id: "f1", name: "Photos", children: [{ id: "f2", name: "Cats", children: [] }] },
];

describe("itemMatchesFolderSubtree", () => {
  it("matches direct and nested folders when the tree is known", () => {
    expect(itemMatchesFolderSubtree(item({ id: "a", folders: ["f2"] }), "f1", tree)).toBe(true);
    expect(itemMatchesFolderSubtree(item({ id: "b", folders: ["f1"] }), "f1", tree)).toBe(true);
    expect(itemMatchesFolderSubtree(item({ id: "c", folders: ["f9"] }), "f1", tree)).toBe(false);
  });

  it("falls back to direct membership when the folder id is missing from the tree", () => {
    expect(
      itemMatchesFolderSubtree(item({ id: "stale", folders: ["missing"] }), "missing", tree),
    ).toBe(true);
    expect(itemMatchesFolderSubtree(item({ id: "other", folders: ["f1"] }), "missing", tree)).toBe(
      false,
    );
  });

  it("excludes deleted items", () => {
    expect(
      itemMatchesFolderSubtree(item({ id: "d", folders: ["f2"], isDeleted: true }), "f1", tree),
    ).toBe(false);
  });
});

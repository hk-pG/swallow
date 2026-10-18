import { describe, expect, it } from "vitest";
import type { Folder, ItemMetadata } from "./library";
import {
  EMPTY_SMART_FOLDER_CRITERIA,
  filterItemsBySmartFolder,
  matchesSmartFolderCriteria,
} from "./smartFolders";

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

describe("matchesSmartFolderCriteria", () => {
  const base = item({ id: "a", name: "Sunset", tags: ["landscape"], folders: ["f2"], star: 3 });

  it("matches empty criteria for non-deleted items", () => {
    expect(matchesSmartFolderCriteria(base, EMPTY_SMART_FOLDER_CRITERIA)).toBe(true);
  });

  it("excludes deleted items", () => {
    expect(
      matchesSmartFolderCriteria({ ...base, isDeleted: true }, EMPTY_SMART_FOLDER_CRITERIA),
    ).toBe(false);
  });

  it("filters by query, tags, folder subtree, and min star", () => {
    expect(matchesSmartFolderCriteria(base, { ...EMPTY_SMART_FOLDER_CRITERIA, query: "sun" })).toBe(
      true,
    );
    expect(
      matchesSmartFolderCriteria(base, {
        ...EMPTY_SMART_FOLDER_CRITERIA,
        tags: ["landscape", "sky"],
        tagMatch: "all",
      }),
    ).toBe(false);
    expect(
      matchesSmartFolderCriteria(base, {
        ...EMPTY_SMART_FOLDER_CRITERIA,
        tags: ["landscape", "sky"],
        tagMatch: "any",
      }),
    ).toBe(true);
    expect(
      matchesSmartFolderCriteria(base, { ...EMPTY_SMART_FOLDER_CRITERIA, folderId: "f1" }, tree),
    ).toBe(true);
    expect(matchesSmartFolderCriteria(base, { ...EMPTY_SMART_FOLDER_CRITERIA, minStar: 4 })).toBe(
      false,
    );
  });
});

describe("filterItemsBySmartFolder", () => {
  it("returns matching ids", () => {
    const items = [
      item({ id: "1", star: 2 }),
      item({ id: "2", star: 4 }),
      item({ id: "3", isDeleted: true, star: 5 }),
    ];
    const result = filterItemsBySmartFolder(items, {
      ...EMPTY_SMART_FOLDER_CRITERIA,
      minStar: 3,
    });
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });
});

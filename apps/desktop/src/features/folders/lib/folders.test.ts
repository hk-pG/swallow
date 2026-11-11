import type { Folder } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { flattenFolderNames, flattenFolders, moveParentOptions } from "./folders";

const tree: Folder[] = [
  {
    id: "a",
    name: "Design",
    children: [{ id: "b", name: "Icons", children: [{ id: "c", name: "SVG", children: [] }] }],
  },
  { id: "d", name: "Photos", children: [] },
];

describe("flattenFolderNames", () => {
  it("includes nested folders", () => {
    const names = flattenFolderNames([
      {
        id: "a",
        name: "Design",
        children: [{ id: "b", name: "Icons", children: [] }],
      },
      { id: "c", name: "Photos", children: [] },
    ]);
    expect(Object.fromEntries(names)).toEqual({ a: "Design", b: "Icons", c: "Photos" });
  });
});

describe("flattenFolders", () => {
  it("records depth and parent in tree order", () => {
    expect(flattenFolders(tree)).toEqual([
      { id: "a", name: "Design", depth: 0, parentId: null },
      { id: "b", name: "Icons", depth: 1, parentId: "a" },
      { id: "c", name: "SVG", depth: 2, parentId: "b" },
      { id: "d", name: "Photos", depth: 0, parentId: null },
    ]);
  });
});

describe("moveParentOptions", () => {
  it("excludes the folder and its descendants", () => {
    expect(moveParentOptions(tree, "b").map((folder) => folder.id)).toEqual(["d"]);
    expect(moveParentOptions(tree, "a").map((folder) => folder.id)).toEqual(["d"]);
    expect(moveParentOptions(tree, "missing").map((folder) => folder.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { subtreeIds } from "./folders";
import type { Folder } from "./library";

const tree: Folder[] = [
  {
    id: "a",
    name: "A",
    children: [{ id: "b", name: "B", children: [{ id: "c", name: "C", children: [] }] }],
  },
  { id: "d", name: "D", children: [] },
];

describe("subtreeIds", () => {
  it("lists the folder then its descendants, depth-first", () => {
    expect(subtreeIds(tree, "a")).toEqual(["a", "b", "c"]);
    expect(subtreeIds(tree, "b")).toEqual(["b", "c"]);
    expect(subtreeIds(tree, "d")).toEqual(["d"]);
  });

  it("returns null when the id is missing", () => {
    expect(subtreeIds(tree, "nope")).toBeNull();
    expect(subtreeIds([], "a")).toBeNull();
  });
});

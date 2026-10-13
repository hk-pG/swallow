import { describe, expect, it } from "vitest";
import { flattenFolderNames } from "./folders";

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

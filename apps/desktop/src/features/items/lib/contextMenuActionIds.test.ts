import { describe, expect, it } from "vitest";
import { contextMenuActionIds } from "./contextMenuActionIds";
import { EMPTY_SELECTION, select, selectAll } from "./selection";

describe("contextMenuActionIds", () => {
  it("returns every selected id when the context target is part of a multi-selection", () => {
    const selection = selectAll(EMPTY_SELECTION, ["a", "b", "c"]);
    expect(contextMenuActionIds(selection, "b").sort()).toEqual(["a", "b", "c"]);
  });

  it("returns only the context target for a single selection", () => {
    const selection = select(EMPTY_SELECTION, ["a"], "a");
    expect(contextMenuActionIds(selection, "a")).toEqual(["a"]);
  });

  it("returns only the context target when it was not selected", () => {
    const selection = select(EMPTY_SELECTION, ["a"], "a");
    expect(contextMenuActionIds(selection, "b")).toEqual(["b"]);
  });
});

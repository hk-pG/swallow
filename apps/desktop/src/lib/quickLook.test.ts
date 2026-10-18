import type { ItemMetadata } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import {
  initialQuickLookId,
  resolveQuickLookTarget,
  stepQuickLookId,
} from "./quickLook";
import { EMPTY_SELECTION, type Selection } from "./selection";

function makeItem(id: string): ItemMetadata {
  return {
    id,
    name: `item-${id}`,
    ext: "png",
    size: 100,
    width: 800,
    height: 600,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
  };
}

const visibleItems = ["a", "b", "c", "d"].map(makeItem);
const visibleIds = visibleItems.map((i) => i.id);

describe("initialQuickLookId", () => {
  it("returns null when nothing is selected", () => {
    expect(initialQuickLookId(EMPTY_SELECTION, visibleIds)).toBeNull();
  });

  it("prefers focus when focus is part of the selection", () => {
    const selection: Selection = {
      ids: new Set(["a", "c"]),
      anchor: "a",
      focus: "c",
    };
    expect(initialQuickLookId(selection, visibleIds)).toBe("c");
  });

  it("falls back to the first selected item in visible order when focus is outside selection", () => {
    const selection: Selection = {
      ids: new Set(["d", "b"]),
      anchor: "b",
      focus: "a",
    };
    expect(initialQuickLookId(selection, visibleIds)).toBe("b");
  });
});

describe("resolveQuickLookTarget", () => {
  it("returns null when activeId is null", () => {
    const selection: Selection = { ids: new Set(["a"]), anchor: "a", focus: "a" };
    expect(resolveQuickLookTarget(null, selection, visibleItems)).toBeNull();
  });

  it("uses all visible items as playlist when a single item is selected", () => {
    const selection: Selection = { ids: new Set(["b"]), anchor: "b", focus: "b" };
    const target = resolveQuickLookTarget("b", selection, visibleItems);
    expect(target).not.toBeNull();
    expect(target?.isMultiSelection).toBe(false);
    expect(target?.playlist.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(target?.index).toBe(1);
    expect(target?.item.id).toBe("b");
  });

  it("uses only selected items in visible order when multiple items are selected", () => {
    const selection: Selection = {
      ids: new Set(["d", "b"]),
      anchor: "b",
      focus: "d",
    };
    const target = resolveQuickLookTarget("d", selection, visibleItems);
    expect(target).not.toBeNull();
    expect(target?.isMultiSelection).toBe(true);
    expect(target?.playlist.map((i) => i.id)).toEqual(["b", "d"]);
    expect(target?.index).toBe(1);
    expect(target?.item.id).toBe("d");
  });

  it("falls back to the first item in playlist if activeId is not in playlist", () => {
    const selection: Selection = {
      ids: new Set(["b", "d"]),
      anchor: "b",
      focus: "b",
    };
    const target = resolveQuickLookTarget("a", selection, visibleItems);
    expect(target?.item.id).toBe("b");
    expect(target?.index).toBe(0);
  });

  it("returns null when playlist is empty", () => {
    const selection: Selection = { ids: new Set(["x", "y"]), anchor: "x", focus: "x" };
    expect(resolveQuickLookTarget("x", selection, visibleItems)).toBeNull();
  });
});

describe("stepQuickLookId", () => {
  it("moves prev and next within playlist and clamps at edges", () => {
    const selection: Selection = {
      ids: new Set(["b", "d"]),
      anchor: "b",
      focus: "b",
    };
    const first = resolveQuickLookTarget("b", selection, visibleItems)!;
    expect(stepQuickLookId(first, "prev")).toBe("b");
    expect(stepQuickLookId(first, "next")).toBe("d");

    const second = resolveQuickLookTarget("d", selection, visibleItems)!;
    expect(stepQuickLookId(second, "prev")).toBe("b");
    expect(stepQuickLookId(second, "next")).toBe("d");
  });
});

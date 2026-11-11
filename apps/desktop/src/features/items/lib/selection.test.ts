import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  isNavigationKey,
  moveFocus,
  nextAfterRemoval,
  retainVisible,
  type Selection,
  select,
  selectAll,
} from "./selection";

const order = ["a", "b", "c", "d", "e"];

function ids(selection: Selection) {
  return [...selection.ids].sort();
}

describe("select", () => {
  it("replaces the selection on a plain click", () => {
    const s = select(select(EMPTY_SELECTION, order, "a"), order, "c");
    expect(ids(s)).toEqual(["c"]);
    expect(s.anchor).toBe("c");
    expect(s.focus).toBe("c");
  });

  it("toggles items with Cmd / Ctrl", () => {
    let s = select(EMPTY_SELECTION, order, "a");
    s = select(s, order, "c", { toggle: true });
    expect(ids(s)).toEqual(["a", "c"]);
    s = select(s, order, "a", { toggle: true });
    expect(ids(s)).toEqual(["c"]);
    expect(s.focus).toBe("a");
  });

  it("selects a range from the anchor with Shift in either direction", () => {
    const start = select(EMPTY_SELECTION, order, "b");
    expect(ids(select(start, order, "d", { range: true }))).toEqual(["b", "c", "d"]);
    const back = select(select(start, order, "d", { range: true }), order, "a", { range: true });
    expect(ids(back)).toEqual(["a", "b"]);
    expect(back.anchor).toBe("b");
  });

  it("adds the range to the selection with Shift + Cmd / Ctrl", () => {
    const s = select(select(EMPTY_SELECTION, order, "a"), order, "c", { toggle: true });
    expect(ids(select(s, order, "e", { range: true, toggle: true }))).toEqual(["a", "c", "d", "e"]);
  });

  it("treats a Shift click without a visible anchor as a plain click", () => {
    const s = select({ ids: new Set(["x"]), anchor: "x", focus: "x" }, order, "c", { range: true });
    expect(ids(s)).toEqual(["c"]);
    expect(s.anchor).toBe("c");
  });
});

describe("selectAll", () => {
  it("selects every visible item and keeps focus", () => {
    const s = selectAll(select(EMPTY_SELECTION, order, "c"), order);
    expect(ids(s)).toEqual(order);
    expect(s.focus).toBe("c");
    expect(selectAll(EMPTY_SELECTION, order).focus).toBe("a");
  });
});

describe("retainVisible", () => {
  it("drops hidden items", () => {
    const s = selectAll(select(EMPTY_SELECTION, order, "b"), order);
    const kept = retainVisible(s, ["a", "c"]);
    expect(ids(kept)).toEqual(["a", "c"]);
    expect(kept.anchor).toBeNull();
    expect(kept.focus).toBeNull();
  });

  it("returns the same object when nothing changes", () => {
    const s = select(EMPTY_SELECTION, order, "b");
    expect(retainVisible(s, order)).toBe(s);
  });
});

describe("moveFocus", () => {
  // a b
  // c d
  // e
  const columns = 2;

  it("moves within the grid", () => {
    expect(moveFocus(order, "a", "ArrowRight", columns)).toBe("b");
    expect(moveFocus(order, "b", "ArrowLeft", columns)).toBe("a");
    expect(moveFocus(order, "a", "ArrowDown", columns)).toBe("c");
    expect(moveFocus(order, "d", "ArrowUp", columns)).toBe("b");
    expect(moveFocus(order, "c", "Home", columns)).toBe("a");
    expect(moveFocus(order, "c", "End", columns)).toBe("e");
  });

  it("stays at the edges", () => {
    expect(moveFocus(order, "a", "ArrowLeft", columns)).toBe("a");
    expect(moveFocus(order, "e", "ArrowRight", columns)).toBe("e");
    expect(moveFocus(order, "b", "ArrowUp", columns)).toBe("b");
    expect(moveFocus(order, "e", "ArrowDown", columns)).toBe("e");
  });

  it("moves down onto a shorter last row", () => {
    expect(moveFocus(order, "d", "ArrowDown", columns)).toBe("e");
  });

  it("starts at the first item without a focus", () => {
    expect(moveFocus(order, null, "ArrowDown", columns)).toBe("a");
    expect(moveFocus(order, "x", "ArrowDown", columns)).toBe("a");
    expect(moveFocus([], null, "ArrowDown", columns)).toBeNull();
  });

  it("treats a missing column count as a single column", () => {
    expect(moveFocus(order, "a", "ArrowDown", 0)).toBe("b");
  });
});

describe("isNavigationKey", () => {
  it("accepts arrows, Home and End only", () => {
    expect(isNavigationKey("ArrowUp")).toBe(true);
    expect(isNavigationKey("End")).toBe(true);
    expect(isNavigationKey("Enter")).toBe(false);
  });
});

describe("nextAfterRemoval", () => {
  it("picks the next remaining item, else the previous one", () => {
    expect(nextAfterRemoval(order, new Set(["b", "c"]), "c")).toBe("d");
    expect(nextAfterRemoval(order, new Set(["d", "e"]), "e")).toBe("c");
    expect(nextAfterRemoval(order, new Set(order), "c")).toBeNull();
    expect(nextAfterRemoval(order, new Set(["a"]), null)).toBeNull();
  });
});

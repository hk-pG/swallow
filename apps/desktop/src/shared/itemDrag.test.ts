import { describe, expect, it } from "vitest";
import {
  isItemDrag,
  readItemDragIds,
  resolveDragItemIds,
  SWALLOW_ITEM_DRAG_MIME,
  setItemDragData,
} from "./itemDrag";

describe("resolveDragItemIds", () => {
  it("returns all selected ids when the dragged id is in the selection", () => {
    expect(resolveDragItemIds(new Set(["a", "b", "c"]), "b")).toEqual(["a", "b", "c"]);
  });

  it("returns a single id when the dragged id is not selected", () => {
    expect(resolveDragItemIds(new Set(["a"]), "b")).toEqual(["b"]);
  });
});

describe("item drag payload", () => {
  it("round-trips ids through dataTransfer", () => {
    let store = "";
    const types: string[] = [];
    const dt = {
      types,
      effectAllowed: "",
      getData(type: string) {
        return type === SWALLOW_ITEM_DRAG_MIME ? store : "";
      },
      setData(type: string, value: string) {
        if (type === SWALLOW_ITEM_DRAG_MIME) {
          store = value;
          if (!types.includes(type)) types.push(type);
        }
      },
    } as unknown as DataTransfer;

    setItemDragData(dt, ["x", "y"]);
    expect(isItemDrag(dt)).toBe(true);
    expect(readItemDragIds(dt)).toEqual(["x", "y"]);
  });
});

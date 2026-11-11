import { describe, expect, it } from "vitest";
import { clampContextMenuPosition } from "./itemContextMenuPosition";

describe("clampContextMenuPosition", () => {
  it("keeps the menu inside the viewport", () => {
    expect(clampContextMenuPosition(900, 700, 160, 120, 1000, 800)).toEqual({ x: 832, y: 672 });
    expect(clampContextMenuPosition(0, 0, 160, 120, 1000, 800)).toEqual({ x: 8, y: 8 });
  });
});

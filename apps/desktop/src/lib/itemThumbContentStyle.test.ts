import { thumbnailSizePx } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { itemThumbContentStyle } from "./itemThumbContentStyle";

describe("itemThumbContentStyle", () => {
  it("sets the thumbnail CSS variable from the size index", () => {
    const style = itemThumbContentStyle(2) as Record<string, string>;
    expect(style["--item-thumb-size"]).toBe(`${thumbnailSizePx(2)}px`);
  });
});

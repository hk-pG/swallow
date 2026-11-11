import { describe, expect, it } from "vitest";
import {
  DEFAULT_THUMBNAIL_SIZE_INDEX,
  resolveItemViewAppearance,
  thumbnailSizePx,
} from "./itemView";

describe("itemView", () => {
  it("defaults", () =>
    expect(resolveItemViewAppearance({})).toEqual({
      itemViewMode: "grid",
      thumbnailSizeIndex: DEFAULT_THUMBNAIL_SIZE_INDEX,
    }));
  it("px", () => expect(thumbnailSizePx(2)).toBe(140));
});

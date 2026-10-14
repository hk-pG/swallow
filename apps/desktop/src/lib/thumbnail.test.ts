import { describe, expect, it } from "vitest";
import { hasThumbnail, itemDirPath } from "./thumbnail";

describe("hasThumbnail", () => {
  it("accepts supported image extensions case-insensitively", () => {
    expect(hasThumbnail("png")).toBe(true);
    expect(hasThumbnail("JPG")).toBe(true);
    expect(hasThumbnail("svg")).toBe(true);
  });

  it("rejects non-image extensions", () => {
    expect(hasThumbnail("pdf")).toBe(false);
    expect(hasThumbnail("")).toBe(false);
  });
});

describe("itemDirPath", () => {
  it("points at the item's .info directory", () => {
    expect(itemDirPath("/lib", "01J")).toBe("/lib/images/01J.info");
  });

  it("ignores trailing separators", () => {
    expect(itemDirPath("C:\\lib\\", "01J")).toBe("C:\\lib/images/01J.info");
  });
});

import type { ItemView } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { nextViewAfterSmartFolderChange } from "./smartFolders";

const library = {
  folders: [
    {
      id: "sf1",
      name: "Fav",
      criteria: { query: "", tags: [], tagMatch: "all" as const, folderId: null, minStar: 1 },
    },
  ],
};

describe("nextViewAfterSmartFolderChange", () => {
  it("keeps non-smart-folder views", () => {
    const view: ItemView = { kind: "all" };
    expect(nextViewAfterSmartFolderChange(view, library)).toEqual(view);
  });

  it("keeps view when folder still exists", () => {
    const view: ItemView = { kind: "smartFolder", smartFolderId: "sf1" };
    expect(nextViewAfterSmartFolderChange(view, library)).toEqual(view);
  });

  it("resets to all when folder was removed", () => {
    expect(
      nextViewAfterSmartFolderChange({ kind: "smartFolder", smartFolderId: "gone" }, library),
    ).toEqual({ kind: "all" });
  });
});

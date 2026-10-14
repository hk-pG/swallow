import { describe, expect, it } from "vitest";
import { filterItems, matchesQuery, matchesView, parseQuery } from "./filter";
import type { ItemMetadata } from "./library";

function item(overrides: Partial<ItemMetadata> & Pick<ItemMetadata, "id">): ItemMetadata {
  return {
    name: overrides.id,
    ext: "png",
    size: 0,
    width: null,
    height: null,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
    ...overrides,
  };
}

const filed = item({ id: "filed", name: "Sunset Beach", folders: ["f1"], tags: ["landscape"] });
const loose = item({ id: "loose", name: "logo", annotation: "ブランド用の素材" });
const trashed = item({ id: "trashed", name: "old draft", folders: ["f1"], isDeleted: true });
const items = [filed, loose, trashed];

const ids = (list: ItemMetadata[]) => list.map((i) => i.id);

describe("matchesView", () => {
  it("all shows only non-deleted items", () => {
    expect(ids(items.filter((i) => matchesView(i, { kind: "all" })))).toEqual(["filed", "loose"]);
  });

  it("uncategorized shows non-deleted items without folders", () => {
    expect(ids(items.filter((i) => matchesView(i, { kind: "uncategorized" })))).toEqual(["loose"]);
  });

  it("trash shows only deleted items", () => {
    expect(ids(items.filter((i) => matchesView(i, { kind: "trash" })))).toEqual(["trashed"]);
  });

  it("folder and tag views exclude deleted items", () => {
    expect(ids(items.filter((i) => matchesView(i, { kind: "folder", folderId: "f1" })))).toEqual([
      "filed",
    ]);
    expect(ids(items.filter((i) => matchesView(i, { kind: "tag", tag: "landscape" })))).toEqual([
      "filed",
    ]);
  });
});

describe("parseQuery", () => {
  it("splits on half- and full-width spaces and drops empties", () => {
    expect(parseQuery("  Foo　bar  ")).toEqual(["foo", "bar"]);
    expect(parseQuery("   ")).toEqual([]);
  });

  it("normalizes full-width characters", () => {
    expect(parseQuery("ＬＯＧＯ")).toEqual(["logo"]);
  });
});

describe("matchesQuery", () => {
  it("matches name, tags and annotation case-insensitively", () => {
    expect(matchesQuery(filed, parseQuery("sunset"))).toBe(true);
    expect(matchesQuery(filed, parseQuery("LANDSCAPE"))).toBe(true);
    expect(matchesQuery(loose, parseQuery("ブランド"))).toBe(true);
    expect(matchesQuery(loose, parseQuery("sunset"))).toBe(false);
  });

  it("requires every term to match", () => {
    expect(matchesQuery(filed, parseQuery("beach landscape"))).toBe(true);
    expect(matchesQuery(filed, parseQuery("beach logo"))).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesQuery(loose, [])).toBe(true);
  });
});

describe("filterItems", () => {
  it("combines view and query", () => {
    expect(ids(filterItems(items, { kind: "all" }, "o"))).toEqual(["loose"]);
    expect(ids(filterItems(items, { kind: "trash" }, "draft"))).toEqual(["trashed"]);
    expect(ids(filterItems(items, { kind: "trash" }, "logo"))).toEqual([]);
    expect(ids(filterItems(items, { kind: "folder", folderId: "f1" }, "beach"))).toEqual(["filed"]);
  });
});

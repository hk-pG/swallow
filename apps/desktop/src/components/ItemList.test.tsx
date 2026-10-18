import type { ItemMetadata } from "@swallow/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_SELECTION } from "../lib/selection";
import { ItemList } from "./ItemList";

describe("ItemList", () => {
  it("renders", () => {
    const item: ItemMetadata = {
      id: "a",
      name: "photo",
      ext: "png",
      size: 1,
      width: null,
      height: null,
      tags: ["nature"],
      folders: [],
      annotation: "",
      star: 3,
      url: null,
      createdAt: 0,
      modifiedAt: 0,
      isDeleted: false,
      colorLabel: null,
    };
    const html = renderToStaticMarkup(
      <ItemList
        libraryPath="/lib"
        items={[item]}
        selection={EMPTY_SELECTION}
        onSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
      />,
    );
    expect(html).toContain("photo");
  });
});

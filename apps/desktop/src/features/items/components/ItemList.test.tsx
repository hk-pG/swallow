import type { ItemMetadata } from "@swallow/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SWALLOW_ITEM_DRAG_MIME } from "../../../shared/itemDrag";
import { EMPTY_SELECTION, selectAll } from "../lib/selection";
import { ItemList } from "./ItemList";

function sample(overrides: Partial<ItemMetadata> = {}): ItemMetadata {
  return {
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
    ...overrides,
  };
}

describe("ItemList", () => {
  it("renders", () => {
    const html = renderToStaticMarkup(
      <ItemList
        libraryPath="/lib"
        items={[sample()]}
        selection={EMPTY_SELECTION}
        onSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
      />,
    );
    expect(html).toContain("photo");
  });

  it("opens ItemContextMenu like the grid", () => {
    const onSelect = vi.fn();
    render(
      <ItemList
        libraryPath="/lib"
        items={[sample()]}
        selection={EMPTY_SELECTION}
        onSelect={onSelect}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onContextTrash={() => {}}
        onContextRevealInExplorer={() => {}}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /photo/ }));
    expect(onSelect).toHaveBeenCalledWith("a", {});
    expect(screen.getByRole("menu", { name: /photo の操作/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "ゴミ箱へ移動" })).toBeTruthy();
  });

  it("includes all selected ids in the drag payload", () => {
    const items = [sample({ id: "a", name: "a" }), sample({ id: "b", name: "b" })];
    const selection = selectAll(EMPTY_SELECTION, ["a", "b"]);
    render(
      <ItemList
        libraryPath="/lib"
        items={items}
        selection={selection}
        onSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onContextTrash={() => {}}
      />,
    );
    let store = "";
    const dataTransfer = {
      types: [] as string[],
      effectAllowed: "",
      dropEffect: "move",
      setData(type: string, value: string) {
        if (type === SWALLOW_ITEM_DRAG_MIME) {
          store = value;
          if (!this.types.includes(type)) this.types.push(type);
        }
      },
      getData(type: string) {
        return type === SWALLOW_ITEM_DRAG_MIME ? store : "";
      },
    };
    const row = screen.getByRole("button", { name: /^a/ });
    fireEvent.dragStart(row, { dataTransfer });
    expect(JSON.parse(dataTransfer.getData(SWALLOW_ITEM_DRAG_MIME))).toEqual(["a", "b"]);
  });
});

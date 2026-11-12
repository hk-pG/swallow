import type { ItemMetadata } from "@swallow/shared";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWALLOW_ITEM_DRAG_MIME } from "../../../shared/itemDrag";
import { EMPTY_SELECTION, select, selectAll } from "../lib/selection";
import { ItemGrid } from "./ItemGrid";

function mockDataTransfer() {
  let store = "";
  const types: string[] = [];
  return {
    types,
    effectAllowed: "",
    setData(type: string, value: string) {
      store = value;
      if (!types.includes(type)) types.push(type);
    },
    getData(type: string) {
      return type === SWALLOW_ITEM_DRAG_MIME ? store : "";
    },
  };
}

afterEach(cleanup);

function sample(id: string): ItemMetadata {
  return {
    id,
    name: id,
    ext: "png",
    size: 1,
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
    colorLabel: null,
  };
}

describe("ItemGrid context menu", () => {
  it("opens the custom menu on right-click and selects the item", () => {
    const onSelect = vi.fn();
    render(
      <ItemGrid
        libraryPath="/lib"
        items={[sample("a")]}
        selection={EMPTY_SELECTION}
        onSelect={onSelect}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onContextTrash={() => {}}
        onContextRevealInExplorer={() => {}}
      />,
    );

    const cell = screen.getByRole("button", { name: "a" });
    fireEvent.contextMenu(cell);

    expect(onSelect).toHaveBeenCalledWith("a", {});
    expect(screen.getByRole("menu", { name: /a の操作/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "ゴミ箱へ移動" })).toBeTruthy();
  });
});

describe("ItemGrid keyboard parity", () => {
  it("Select-All, Quick Look, Delete, and Escape match the shared hook", () => {
    const onSelectAll = vi.fn();
    const onClearSelection = vi.fn();
    const onDelete = vi.fn();
    const onQuickLook = vi.fn();
    const items = [sample("a"), sample("b")];
    const { container } = render(
      <ItemGrid
        libraryPath="/lib"
        items={items}
        selection={select(EMPTY_SELECTION, ["a"], "a")}
        onSelect={() => {}}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
        onQuickLook={onQuickLook}
        onContextTrash={() => {}}
      />,
    );

    const grid = within(container);
    const cell = grid.getByRole("button", { name: "a" });
    fireEvent.contextMenu(cell);
    expect(grid.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(cell, { key: "a", metaKey: true });
    expect(onSelectAll).toHaveBeenCalled();

    fireEvent.keyDown(cell, { key: " " });
    expect(onQuickLook).toHaveBeenCalledWith("a");

    fireEvent.keyDown(cell, { key: "Delete" });
    expect(onDelete).toHaveBeenCalled();

    fireEvent.keyDown(cell, { key: "Escape" });
    expect(onClearSelection).toHaveBeenCalled();
    expect(grid.queryByRole("menu")).toBeNull();
  });
});

describe("ItemGrid folder drag", () => {
  it("puts a single id in the drag payload when nothing is selected", () => {
    const onSelect = vi.fn();
    const items = [sample("a"), sample("b")];
    render(
      <ItemGrid
        libraryPath="/lib"
        items={items}
        selection={EMPTY_SELECTION}
        onSelect={onSelect}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onContextTrash={() => {}}
      />,
    );
    const cell = screen.getByRole("button", { name: "a" });
    const dataTransfer = mockDataTransfer();
    fireEvent.dragStart(cell, { dataTransfer });
    expect(onSelect).toHaveBeenCalledWith("a", {});
    expect(JSON.parse(dataTransfer.getData(SWALLOW_ITEM_DRAG_MIME))).toEqual(["a"]);
  });

  it("puts every selected id in the drag payload", () => {
    const items = [sample("a"), sample("b"), sample("c")];
    const selection = selectAll(EMPTY_SELECTION, ["a", "b", "c"]);
    render(
      <ItemGrid
        libraryPath="/lib"
        items={items}
        selection={selection}
        onSelect={() => {}}
        onSelectAll={() => {}}
        onClearSelection={() => {}}
        onContextTrash={() => {}}
      />,
    );
    const cell = screen.getByRole("button", { name: "b" });
    const dataTransfer = mockDataTransfer();
    fireEvent.dragStart(cell, { dataTransfer });
    const payload = JSON.parse(dataTransfer.getData(SWALLOW_ITEM_DRAG_MIME)) as string[];
    expect(payload).toContain("a");
    expect(payload).toContain("b");
    expect(payload).toContain("c");
    expect(payload).toHaveLength(3);
  });
});

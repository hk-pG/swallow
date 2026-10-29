import type { ItemMetadata } from "@swallow/shared";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SELECTION, select } from "../lib/selection";
import { ItemGrid } from "./ItemGrid";

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

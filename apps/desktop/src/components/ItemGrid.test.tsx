import type { ItemMetadata } from "@swallow/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_SELECTION } from "../lib/selection";
import { ItemGrid } from "./ItemGrid";

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

    const cell = screen.getByRole("button", { name: /a\.png/i });
    fireEvent.contextMenu(cell);

    expect(onSelect).toHaveBeenCalledWith("a", {});
    expect(screen.getByRole("menu", { name: /a の操作/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "ゴミ箱へ移動" })).toBeTruthy();
  });
});

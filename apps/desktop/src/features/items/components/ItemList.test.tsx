import type { ItemMetadata } from "@swallow/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_SELECTION } from "../lib/selection";
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
});

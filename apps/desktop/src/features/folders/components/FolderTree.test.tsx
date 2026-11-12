import type { Folder, ItemMetadata } from "@swallow/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWALLOW_ITEM_DRAG_MIME } from "../../../shared/itemDrag";
import { Inspector } from "../../inspector";
import { FolderTree } from "./FolderTree";

const folders: Folder[] = [
  {
    id: "a",
    name: "Design",
    children: [{ id: "b", name: "Icons", children: [] }],
  },
  { id: "c", name: "Photos", children: [] },
];

const noop = async () => {};

describe("FolderTree", () => {
  afterEach(() => cleanup());

  it("renders folder icons and labels without inline action panels", () => {
    const { container } = render(
      <FolderTree
        folders={folders}
        selectedId="b"
        onSelect={() => {}}
        onCreate={noop}
        onRename={noop}
        onDelete={noop}
        onMove={noop}
      />,
    );
    expect(container.querySelector(".folder-icon")).toBeTruthy();
    expect(container.querySelector(".folder-depth-guides")).toBeTruthy();
    expect(container.textContent).toContain("Design");
    expect(container.textContent).toContain("Icons");
    expect(container.textContent).not.toContain("folder-actions");
    expect(container.textContent).not.toContain("子フォルダ");
    expect(container.textContent).not.toContain("移動…");
  });

  it("opens a context menu with folder actions on right click", () => {
    render(
      <FolderTree
        folders={folders}
        selectedId="b"
        onSelect={() => {}}
        onCreate={noop}
        onRename={noop}
        onDelete={noop}
        onMove={noop}
      />,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: /Icons/ }));
    expect(screen.getByRole("menu", { name: "Icons の操作" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "子フォルダを作成…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "削除" })).toBeTruthy();
  });

  it("calls onDelete from the context menu", () => {
    const onDelete = vi.fn(async () => {});
    render(
      <FolderTree
        folders={folders}
        selectedId="b"
        onSelect={() => {}}
        onCreate={noop}
        onRename={noop}
        onDelete={onDelete}
        onMove={noop}
      />,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: /Icons/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "削除" }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });

  it("highlights a folder row on item drag-over and assigns on drop", async () => {
    const onAssignItems = vi.fn(async () => {});
    const itemIds = ["item-1", "item-2"];
    const dataTransfer = {
      types: [SWALLOW_ITEM_DRAG_MIME],
      effectAllowed: "move",
      dropEffect: "move",
      setData: () => {},
      getData: (type: string) => (type === SWALLOW_ITEM_DRAG_MIME ? JSON.stringify(itemIds) : ""),
    };
    const { container } = render(
      <FolderTree
        folders={folders}
        selectedId={null}
        onSelect={() => {}}
        onCreate={noop}
        onRename={noop}
        onDelete={noop}
        onMove={noop}
        onAssignItems={onAssignItems}
      />,
    );
    const folderBtn = screen.getByRole("button", { name: /Icons/ });
    fireEvent.dragEnter(folderBtn, { dataTransfer });
    fireEvent.dragOver(folderBtn, { dataTransfer });
    expect(folderBtn.className).toContain("drop-target");
    fireEvent.drop(folderBtn, { dataTransfer });
    expect(onAssignItems).toHaveBeenCalledWith(itemIds, "b");
    expect(container.querySelector(".drop-target")).toBeNull();
  });
});

function item(folderIds: string[]): ItemMetadata {
  return {
    id: "item",
    name: "logo",
    ext: "png",
    size: 10,
    width: null,
    height: null,
    tags: [],
    folders: folderIds,
    annotation: "",
    star: 0,
    colorLabel: null,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
  };
}

describe("Inspector folders", () => {
  it("shows folder names and can remove an assignment", () => {
    const html = renderToStaticMarkup(
      <Inspector
        item={item(["b"])}
        folders={folders}
        onSave={noop}
        onAssignFolder={noop}
        onUnassignFolder={noop}
      />,
    );
    expect(html).toContain("Icons");
    expect(html).toContain("Icons から外す");
    expect(html).not.toContain(">b<");
  });
});

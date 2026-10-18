import type { Folder, ItemMetadata } from "@swallow/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FolderTree } from "./FolderTree";
import { Inspector } from "./Inspector";

const folders: Folder[] = [
  {
    id: "a",
    name: "Design",
    children: [{ id: "b", name: "Icons", children: [] }],
  },
  { id: "c", name: "Photos", children: [] },
];

const noop = async () => {};

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

describe("FolderTree", () => {
  it("renders nested folders and actions for the selected one", () => {
    const html = renderToStaticMarkup(
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
    expect(html).toContain("Design");
    expect(html).toContain("Icons");
    expect(html).toContain("Photos");
    expect(html).toContain("子フォルダ");
    expect(html).toContain("削除");
    expect(html).toContain("移動…");
    expect(html).toContain("トップレベル");
    expect(html).toContain('class="sidebar-section-header"');
    // Icons だけが子。字下げはノードのクラスで一度だけ足し、操作パネルの padding ではずらさない。
    expect(html.match(/folder-node-nested/g)).toHaveLength(1);
    expect(html).not.toContain("padding-left");
  });
});

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

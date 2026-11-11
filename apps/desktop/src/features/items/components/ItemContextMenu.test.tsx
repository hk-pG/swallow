import type { ItemMetadata } from "@swallow/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemContextMenu } from "./ItemContextMenu";

function item(overrides: Partial<ItemMetadata> = {}): ItemMetadata {
  return {
    id: "A",
    name: "photo",
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
    ...overrides,
  };
}

describe("ItemContextMenu", () => {
  it("lists library actions for a normal item", () => {
    const html = renderToStaticMarkup(
      <ItemContextMenu
        state={{ item: item(), x: 10, y: 20 }}
        isTrashView={false}
        onClose={() => {}}
        onTrash={() => {}}
        onRestore={() => {}}
        onPurge={() => {}}
        onEditTags={() => {}}
        onRevealInExplorer={() => {}}
      />,
    );
    expect(html).toContain("ゴミ箱へ移動");
    expect(html).toContain("タグを編集…");
    expect(html).toContain("エクスプローラーで表示");
  });

  it("lists trash actions in the trash view", () => {
    const html = renderToStaticMarkup(
      <ItemContextMenu
        state={{ item: item({ isDeleted: true }), x: 10, y: 20 }}
        isTrashView
        onClose={() => {}}
        onTrash={() => {}}
        onRestore={() => {}}
        onPurge={() => {}}
        onEditTags={() => {}}
        onRevealInExplorer={() => {}}
      />,
    );
    expect(html).toContain("復元");
    expect(html).toContain("完全に削除");
    expect(html).not.toContain("ゴミ箱へ移動");
  });
});

import type { ItemMetadata } from "@swallow/shared";
import { EMPTY_SMART_FOLDER_CRITERIA } from "@swallow/shared";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InspectorPane } from "../../inspector";
import { EMPTY_SELECTION } from "../lib/selection";
import { LibraryToolbar } from "./LibraryToolbar";
import { MainItemView, resolveMainEmptyState } from "./MainItemView";

describe("resolveMainEmptyState", () => {
  it("maps library / items / matches to empty states", () => {
    expect(resolveMainEmptyState(null, 0, 0)).toBe("no-library");
    expect(resolveMainEmptyState("/lib", 0, 0)).toBe("no-items");
    expect(resolveMainEmptyState("/lib", 3, 0)).toBe("no-matches");
    expect(resolveMainEmptyState("/lib", 3, 2)).toBeNull();
  });
});

describe("LibraryToolbar", () => {
  it("renders search and import actions", () => {
    const html = renderToStaticMarkup(
      <LibraryToolbar
        disabled={false}
        query="q"
        onQueryChange={() => {}}
        searchCriteria={EMPTY_SMART_FOLDER_CRITERIA}
        onSearchCriteriaChange={() => {}}
        onClearAdvancedSearch={() => {}}
        folders={[]}
        libraryTagNames={[]}
        appearance={{
          itemView: { itemViewMode: "grid", thumbnailSizeIndex: 1 },
          setItemViewMode: () => {},
          setThumbnailSizeIndex: () => {},
        }}
        quickLookDisabled={false}
        onQuickLook={() => {}}
        importing={false}
        onPickAndImport={() => {}}
        onPickFoldersAndImport={() => {}}
      />,
    );
    expect(html).toContain('placeholder="名前・タグ・注釈で検索"');
    expect(html).toContain("ファイル取り込み");
  });
});

describe("InspectorPane", () => {
  const sampleItems = [
    {
      id: "a",
      name: "A",
      ext: "png",
      size: 1,
      width: null,
      height: null,
      tags: ["shared"],
      folders: [],
      annotation: "",
      star: 0,
      colorLabel: "red" as const,
      url: null,
      createdAt: 0,
      modifiedAt: 0,
      isDeleted: false,
    },
    {
      id: "b",
      name: "B",
      ext: "png",
      size: 1,
      width: null,
      height: null,
      tags: ["other"],
      folders: [],
      annotation: "",
      star: 0,
      colorLabel: null,
      url: null,
      createdAt: 0,
      modifiedAt: 0,
      isDeleted: false,
    },
  ];

  it("shows multi-select bulk inspector", () => {
    const html = renderToStaticMarkup(
      <InspectorPane
        selectedCount={2}
        selectedItems={sampleItems}
        selected={null}
        folders={[]}
        libraryTagNames={[]}
        onSave={async () => {}}
        onSaveItems={async () => {}}
        onAssignFolder={async () => {}}
        onUnassignFolder={async () => {}}
        onAddTags={async () => {}}
        onRemoveTags={async () => {}}
        onAddTagsToItems={async () => {}}
        onRemoveTagsFromItems={async () => {}}
        trash={{
          trashSelected: async () => {},
          restoreSelected: async () => {},
          purgeSelected: async () => {},
        }}
      />,
    );
    expect(html).toContain("2 件を選択中");
    expect(html).toContain('data-multi-inspector="true"');
    expect(html).toContain("shared");
    expect(html).toContain("other");
    expect(html).toContain("選択中すべてにタグを追加");
  });
});

describe("MainItemView", () => {
  const noop = () => {};

  it("renders no-library empty state with open actions", () => {
    const html = renderToStaticMarkup(
      <MainItemView
        libraryPath={null}
        itemCount={0}
        visibleItems={[]}
        itemViewMode="grid"
        selection={EMPTY_SELECTION}
        recentLibraries={["/recent/lib"]}
        onSelect={noop}
        onSelectAll={noop}
        onClearSelection={noop}
        onCreateLibrary={noop}
        onOpenLibrary={noop}
        onOpenRecent={noop}
      />,
    );
    expect(html).toContain("ライブラリが開かれていません");
    expect(html).toContain("新規ライブラリを作成");
    expect(html).toContain("/recent/lib");
  });

  it("renders no-items and no-matches placeholders", () => {
    const noItems = renderToStaticMarkup(
      <MainItemView
        libraryPath="/lib"
        itemCount={0}
        visibleItems={[]}
        itemViewMode="grid"
        selection={EMPTY_SELECTION}
        recentLibraries={[]}
        onSelect={noop}
        onSelectAll={noop}
        onClearSelection={noop}
        onCreateLibrary={noop}
        onOpenLibrary={noop}
        onOpenRecent={noop}
      />,
    );
    expect(noItems).toContain("ファイルをドロップして取り込み");

    const noMatches = renderToStaticMarkup(
      <MainItemView
        libraryPath="/lib"
        itemCount={2}
        visibleItems={[]}
        itemViewMode="list"
        selection={EMPTY_SELECTION}
        recentLibraries={[]}
        onSelect={noop}
        onSelectAll={noop}
        onClearSelection={noop}
        onCreateLibrary={noop}
        onOpenLibrary={noop}
        onOpenRecent={noop}
      />,
    );
    expect(noMatches).toContain("該当するアイテムがありません");
  });

  const thumbItem: ItemMetadata = {
    id: "thumb",
    name: "photo",
    ext: "png",
    size: 1,
    width: null,
    height: null,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    colorLabel: null,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
  };

  const itemViewProps = (itemViewMode: "grid" | "list") => ({
    libraryPath: "/lib",
    itemCount: 1,
    visibleItems: [thumbItem],
    itemViewMode,
    selection: EMPTY_SELECTION,
    recentLibraries: [] as string[],
    onSelect: noop,
    onSelectAll: noop,
    onClearSelection: noop,
    onCreateLibrary: noop,
    onOpenLibrary: noop,
    onOpenRecent: noop,
  });

  it("sets draggable=false on thumbnail images in grid and list", () => {
    const { container: gridRoot } = render(<MainItemView {...itemViewProps("grid")} />);
    const gridThumb = gridRoot.querySelector("img");
    expect(gridThumb).not.toBeNull();
    expect(gridThumb?.getAttribute("draggable")).toBe("false");

    const { container: listRoot } = render(<MainItemView {...itemViewProps("list")} />);
    const listThumb = listRoot.querySelector("img");
    expect(listThumb).not.toBeNull();
    expect(listThumb?.getAttribute("draggable")).toBe("false");
  });
});

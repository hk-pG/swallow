import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_SELECTION } from "../lib/selection";
import { MainItemView, resolveMainEmptyState } from "./MainItemView";

describe("resolveMainEmptyState", () => {
  it("maps library / items / matches to empty states", () => {
    expect(resolveMainEmptyState(null, 0, 0)).toBe("no-library");
    expect(resolveMainEmptyState("/lib", 0, 0)).toBe("no-items");
    expect(resolveMainEmptyState("/lib", 3, 0)).toBe("no-matches");
    expect(resolveMainEmptyState("/lib", 3, 2)).toBeNull();
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
});

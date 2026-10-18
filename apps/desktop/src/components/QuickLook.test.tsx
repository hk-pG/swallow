import type { ItemMetadata } from "@swallow/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { QuickLookTarget } from "../lib/quickLook";
import { QuickLook, quickLookScopeHint } from "./QuickLook";

function item(id: string): ItemMetadata {
  return {
    id,
    name: "photo",
    ext: "png",
    size: 10,
    width: 1920,
    height: 1080,
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

function target(overrides: Partial<QuickLookTarget> = {}): QuickLookTarget {
  const playlist = [item("a"), item("b")];
  const first = playlist[0] ?? item("a");
  return {
    item: first,
    playlist,
    index: 0,
    isMultiSelection: false,
    ...overrides,
  };
}

describe("quickLookScopeHint", () => {
  it("describes multi-selection vs full list navigation", () => {
    expect(quickLookScopeHint(target())).toContain("表示中の一覧");
    expect(quickLookScopeHint(target({ isMultiSelection: true }))).toContain("選択中の 2 件");
  });
});

describe("QuickLook", () => {
  it("renders preview chrome and unsupported message", () => {
    const html = renderToStaticMarkup(
      <QuickLook
        libraryPath="/lib"
        target={target()}
        scaleMode="fit"
        onScaleModeChange={() => {}}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(html).toContain("photo.png");
    expect(html).toContain("原寸表示");
    expect(html).toContain("表示中の一覧");

    const pdf = renderToStaticMarkup(
      <QuickLook
        libraryPath="/lib"
        target={target({ item: { ...item("x"), ext: "pdf", name: "doc" } })}
        scaleMode="fit"
        onScaleModeChange={() => {}}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(pdf).toContain("PDF");
    expect(pdf).toContain("対応していません");
  });
});

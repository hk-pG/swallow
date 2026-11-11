import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdvancedSearch } from "./AdvancedSearch";

describe("AdvancedSearch", () => {
  it("mentions unsupported EXIF attributes when open", () => {
    const html = renderToStaticMarkup(
      <AdvancedSearch
        criteria={{ query: "", tags: [], tagMatch: "all", folderId: null, minStar: null }}
        onChange={() => {}}
        onClear={() => {}}
        folders={[]}
        libraryTags={[]}
      />,
    );
    expect(html).toContain("高度検索");
    expect(html).toContain('aria-expanded="false"');
  });
});

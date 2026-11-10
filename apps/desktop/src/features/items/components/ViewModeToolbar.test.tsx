import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewModeToolbar, viewModeToolbarZoomLabel } from "./ViewModeToolbar";

describe("ViewModeToolbar", () => {
  it("renders", () => {
    expect(viewModeToolbarZoomLabel(2)).toBe("140px");
    const html = renderToStaticMarkup(
      <ViewModeToolbar
        itemViewMode="list"
        thumbnailSizeIndex={1}
        onViewModeChange={() => {}}
        onThumbnailSizeIndexChange={() => {}}
      />,
    );
    expect(html).toContain("120px");
  });
});

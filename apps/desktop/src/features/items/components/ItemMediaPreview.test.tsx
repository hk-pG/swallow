import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemMediaPreview } from "./ItemMediaPreview";

const baseItem = {
  id: "01ITEM",
  name: "asset",
  ext: "png",
};

describe("ItemMediaPreview", () => {
  it("renders image preview for raster types", () => {
    const html = renderToStaticMarkup(
      <ItemMediaPreview libraryPath="/lib" item={baseItem} scaleMode="fit" fileLabel="asset.png" />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("quick-look-image-fit");
  });

  it("renders video element for mp4", () => {
    const html = renderToStaticMarkup(
      <ItemMediaPreview
        libraryPath="/lib"
        item={{ ...baseItem, ext: "mp4" }}
        scaleMode="fit"
        fileLabel="asset.mp4"
      />,
    );
    expect(html).toContain("<video");
    expect(html).toContain("controls");
  });

  it("shows placeholder for unsupported pdf", () => {
    const html = renderToStaticMarkup(
      <ItemMediaPreview
        libraryPath="/lib"
        item={{ ...baseItem, ext: "pdf" }}
        scaleMode="fit"
        fileLabel="asset.pdf"
      />,
    );
    expect(html).toContain("PDF");
    expect(html).toContain("対応していません");
    expect(html).not.toContain("<img");
  });
});

import { describe, expect, it } from "vitest";
import {
  FONT_PREVIEW_EXTS,
  hasQuickLookPreview,
  resolveItemPreviewKind,
  VIDEO_PREVIEW_EXTS,
} from "./previewKind";

describe("resolveItemPreviewKind", () => {
  it("classifies raster and svg as image", () => {
    expect(resolveItemPreviewKind("png")).toBe("image");
    expect(resolveItemPreviewKind("SVG")).toBe("image");
  });

  it("classifies configured video and font extensions", () => {
    for (const ext of VIDEO_PREVIEW_EXTS) {
      expect(resolveItemPreviewKind(ext)).toBe("video");
    }
    for (const ext of FONT_PREVIEW_EXTS) {
      expect(resolveItemPreviewKind(ext)).toBe("font");
    }
  });

  it("treats pdf and unknown as unsupported", () => {
    expect(resolveItemPreviewKind("pdf")).toBe("unsupported");
    expect(resolveItemPreviewKind("xyz")).toBe("unsupported");
  });
});

describe("hasQuickLookPreview", () => {
  it("is true for image, video, and font", () => {
    expect(hasQuickLookPreview("jpg")).toBe(true);
    expect(hasQuickLookPreview("mp4")).toBe(true);
    expect(hasQuickLookPreview("woff2")).toBe(true);
  });

  it("is false for unsupported", () => {
    expect(hasQuickLookPreview("pdf")).toBe(false);
  });
});

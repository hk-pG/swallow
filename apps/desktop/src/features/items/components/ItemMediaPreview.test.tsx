import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCollectingDiagnosticLogger,
  resetDiagnosticLogger,
  setDiagnosticLogger,
} from "../../../shared/diagnostic-log";
import { ItemMediaPreview } from "./ItemMediaPreview";

const baseItem = {
  id: "01ITEM",
  name: "asset",
  ext: "png",
};

function ParentThatRerendersOnLoad() {
  const [, setParentTick] = useState(0);
  return (
    <ItemMediaPreview
      libraryPath="/lib"
      item={{ ...baseItem, ext: "woff2" }}
      scaleMode="fit"
      fileLabel="asset.woff2"
      onLoadingChange={(loading) => {
        if (!loading) {
          setParentTick((n) => n + 1);
        }
      }}
    />
  );
}

describe("ItemMediaPreview", () => {
  it("renders image preview for raster types", () => {
    const html = renderToStaticMarkup(
      <ItemMediaPreview libraryPath="/lib" item={baseItem} scaleMode="fit" fileLabel="asset.png" />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("quick-look-image-fit");
  });

  it("logs structured fields when video preview fails", () => {
    const sink: Parameters<typeof createCollectingDiagnosticLogger>[0] = [];
    setDiagnosticLogger(createCollectingDiagnosticLogger(sink));
    const { container } = render(
      <ItemMediaPreview
        libraryPath="/lib"
        item={{ ...baseItem, ext: "mp4" }}
        scaleMode="fit"
        fileLabel="asset.mp4"
      />,
    );
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    Object.defineProperty(video, "error", {
      configurable: true,
      value: { code: 4, message: "MEDIA_ERR_SRC_NOT_SUPPORTED" },
    });
    fireEvent.error(video as HTMLVideoElement);
    expect(sink).toHaveLength(1);
    expect(sink[0]?.fields).toMatchObject({
      source: "video-preview",
      itemId: "01ITEM",
      ext: "mp4",
      mediaErrorCode: 4,
      urlScheme: "thumb",
    });
    resetDiagnosticLogger();
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

describe("ItemMediaPreview font load", () => {
  const fontLoad = vi.fn();
  const fontsAdd = vi.fn();
  const fontsDelete = vi.fn();

  class FontFaceStub {
    family = "mock-preview-font";
    load = () => fontLoad();
    constructor(_family: string, _src: string) {
      void _family;
      void _src;
    }
  }

  beforeEach(() => {
    fontLoad.mockImplementation(() =>
      Promise.resolve({
        family: "mock-preview-font",
        status: "loaded",
      }),
    );
    vi.stubGlobal("FontFace", FontFaceStub);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        add: fontsAdd,
        delete: fontsDelete,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("calls FontFace.load only once when parent re-renders after onLoadingChange", async () => {
    await act(async () => {
      render(<ParentThatRerendersOnLoad />);
    });

    await waitFor(() => {
      expect(fontLoad).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fontLoad).toHaveBeenCalledTimes(1);
    expect(fontsAdd).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  createCollectingDiagnosticLogger,
  previewUrlScheme,
  resetDiagnosticLogger,
  setDiagnosticLogger,
} from "./index";
import { logPreviewFailure } from "./preview";

describe("previewUrlScheme", () => {
  it("extracts scheme without path", () => {
    expect(previewUrlScheme("thumb://localhost/encoded?full=1")).toBe("thumb");
    expect(previewUrlScheme("https://example.com/x")).toBe("https");
  });
});

describe("logPreviewFailure", () => {
  afterEach(() => {
    resetDiagnosticLogger();
  });

  it("records structured preview failure fields", () => {
    const sink: Parameters<typeof createCollectingDiagnosticLogger>[0] = [];
    setDiagnosticLogger(createCollectingDiagnosticLogger(sink));

    logPreviewFailure({
      source: "video-preview",
      component: "ItemMediaPreview",
      itemId: "01ABC",
      ext: "mp4",
      src: "thumb://localhost/foo?full=1",
      fileSize: 1024,
      mediaErrorCode: 4,
      mediaErrorMessage: "MEDIA_ERR_SRC_NOT_SUPPORTED",
    });

    expect(sink).toHaveLength(1);
    expect(sink[0]?.level).toBe("error");
    expect(sink[0]?.message).toBe("preview failed");
    expect(sink[0]?.fields).toMatchObject({
      source: "video-preview",
      component: "ItemMediaPreview",
      itemId: "01ABC",
      ext: "mp4",
      mediaType: "video",
      urlScheme: "thumb",
      fileSize: 1024,
      mediaErrorCode: 4,
      mediaErrorMessage: "MEDIA_ERR_SRC_NOT_SUPPORTED",
    });
    expect(sink[0]?.fields?.src).toBeUndefined();
  });
});

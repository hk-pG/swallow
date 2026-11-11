import { describe, expect, it } from "vitest";
import { isExtensionRequest, isExtensionResponse } from "./extensionProtocol";

describe("extension protocol", () => {
  it("accepts list and save messages from the popup", () => {
    expect(isExtensionRequest({ type: "list-images", tabId: 3 })).toBe(true);
    expect(
      isExtensionRequest({
        type: "save-image",
        tabId: 3,
        imageIndex: 0,
        srcUrl: "https://cdn.example/a.png",
      }),
    ).toBe(true);
    expect(isExtensionRequest({ type: "save-image", tabId: 3, imageIndex: 1 })).toBe(true);
    expect(isExtensionRequest({ type: "save-image", tabId: -1, imageIndex: 0 })).toBe(false);
    expect(isExtensionRequest({ type: "save-image", tabId: 1.5, imageIndex: 0 })).toBe(false);
    expect(isExtensionRequest({ type: "other", tabId: 1 })).toBe(false);
    expect(isExtensionRequest(null)).toBe(false);
  });

  it("accepts save results and image lists", () => {
    expect(isExtensionResponse({ ok: true, images: [] })).toBe(true);
    expect(isExtensionResponse({ ok: false, message: "保存に失敗しました。" })).toBe(true);
    expect(isExtensionResponse({ ok: true, message: "Swallow に保存しました。" })).toBe(true);
    expect(isExtensionResponse({ ok: true })).toBe(false);
    expect(isExtensionResponse({ ok: false })).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesFromBase64, bytesToBase64 } from "./imageBytes";
import { listImagesInPage, readBlobUrlInPage, readImageAtInPage } from "./pageImage";

interface FakeImage {
  currentSrc?: string;
  src: string;
  alt?: string;
  naturalWidth: number;
  naturalHeight: number;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("page images", () => {
  it("lists saveable images and skips tracking pixels and non-image URLs", () => {
    stubImages([
      { src: "https://cdn.example/cat%20photo.png", alt: "", naturalWidth: 100, naturalHeight: 80 },
      {
        src: "https://cdn.example/cat%20photo.png",
        alt: "dup",
        naturalWidth: 100,
        naturalHeight: 80,
      },
      { src: "https://cdn.example/pixel.gif", alt: "", naturalWidth: 1, naturalHeight: 1 },
      { src: "javascript:alert(1)", alt: "", naturalWidth: 10, naturalHeight: 10 },
      {
        currentSrc: "",
        src: "blob:https://example.com/abc",
        alt: "  draft  ",
        naturalWidth: 0,
        naturalHeight: 0,
      },
      { src: "data:image/png;base64,AAAA", alt: "", naturalWidth: 0, naturalHeight: 0 },
    ]);

    expect(listImagesInPage()).toEqual([
      {
        index: 0,
        label: "cat photo.png",
        width: 100,
        height: 80,
        srcUrl: "https://cdn.example/cat%20photo.png",
      },
      {
        index: 4,
        label: "draft",
        width: 0,
        height: 0,
        srcUrl: "blob:https://example.com/abc",
      },
      {
        index: 5,
        label: "画像 3",
        width: 0,
        height: 0,
      },
    ]);
  });

  it("reads a blob URL in the page and refuses an oversized body", async () => {
    const bytes = Uint8Array.of(1, 2, 3, 4);
    vi.stubGlobal("fetch", async (input: RequestInfo) => {
      expect(String(input)).toBe("blob:https://example.com/abc");
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "image/png; charset=binary" },
      });
    });
    const read = await readBlobUrlInPage("blob:https://example.com/abc", 100);
    expect(read).toEqual({ ok: true, base64: bytesToBase64(bytes), mime: "image/png" });

    vi.stubGlobal(
      "fetch",
      async () => new Response(bytes, { status: 200, headers: { "content-type": "image/png" } }),
    );
    expect(await readBlobUrlInPage("blob:https://example.com/abc", 2)).toEqual({
      ok: false,
      reason: "tooLarge",
    });
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await readBlobUrlInPage("blob:https://example.com/abc", 100)).toEqual({
      ok: false,
      reason: "fetch",
    });
  });

  it("returns remote URLs as-is and decodes data URLs under the transfer cap", async () => {
    const bytes = Uint8Array.of(1, 2, 3, 4);
    const dataUrl = `data:image/png;base64,${bytesToBase64(bytes)}`;
    stubImages([
      { src: "https://cdn.example/a.png", naturalWidth: 10, naturalHeight: 10 },
      { src: dataUrl, naturalWidth: 10, naturalHeight: 10 },
      { src: dataUrl, naturalWidth: 10, naturalHeight: 10 },
    ]);
    vi.stubGlobal("fetch", () => {
      throw new Error("remote URLs are fetched in the service worker");
    });

    expect(await readImageAtInPage(0, 100)).toEqual({
      ok: true,
      mode: "url",
      url: "https://cdn.example/a.png",
    });
    const decoded = await readImageAtInPage(1, 100);
    expect(decoded.ok).toBe(true);
    if (decoded.ok && decoded.mode === "bytes") {
      expect(decoded.mime).toBe("image/png");
      expect(bytesFromBase64(decoded.base64)).toEqual(bytes);
    }
    expect(await readImageAtInPage(2, 1)).toEqual({ ok: false, reason: "tooLarge" });
    expect(await readImageAtInPage(9, 100)).toEqual({ ok: false, reason: "missing" });
  });
});

function stubImages(images: FakeImage[]) {
  vi.stubGlobal("document", { images });
}

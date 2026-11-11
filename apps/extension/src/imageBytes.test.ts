import { describe, expect, it } from "vitest";
import {
  bytesFromBase64,
  bytesToBase64,
  decodeDataUrl,
  imageParts,
  imageScheme,
  sniffExt,
  sourcePageUrl,
} from "./imageBytes";

const pngBytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

describe("image bytes", () => {
  it("classifies schemes without treating the image URL as a page URL", () => {
    expect(imageScheme("https://cdn.example/a.png")).toBe("http");
    expect(imageScheme("HTTP://cdn.example/a.png")).toBe("http");
    expect(imageScheme("data:image/png;base64,AAAA")).toBe("data");
    expect(imageScheme("blob:https://example.com/11111111-1111-1111-1111-111111111111")).toBe(
      "blob",
    );
    expect(imageScheme("javascript:alert(1)")).toBe("other");
  });

  it("keeps http(s) page URLs and drops other schemes", () => {
    expect(sourcePageUrl("https://gallery.example/posts/1?q=1#top")).toBe(
      "https://gallery.example/posts/1?q=1#top",
    );
    expect(sourcePageUrl("http://127.0.0.1/page")).toBe("http://127.0.0.1/page");
    expect(sourcePageUrl("chrome://newtab/")).toBeUndefined();
    expect(
      sourcePageUrl("chrome-extension://fpcegcbemljdnihmoaejmmbpijdffgfn/popup.html"),
    ).toBeUndefined();
    expect(sourcePageUrl("")).toBeUndefined();
    expect(sourcePageUrl(undefined)).toBeUndefined();
  });

  it("decodes base64 and percent-encoded data URLs", () => {
    const base64 = bytesToBase64(pngBytes);
    const decoded = decodeDataUrl(`data:image/png;base64,${base64}`);
    expect(decoded?.mime).toBe("image/png");
    expect(decoded?.bytes).toEqual(pngBytes);

    const svg = decodeDataUrl("data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E");
    expect(svg?.mime).toBe("image/svg+xml");
    expect(new TextDecoder().decode(svg?.bytes)).toBe("<svg></svg>");
    expect(decodeDataUrl("data:image/png;base64,!!!!")).toBeNull();
    expect(decodeDataUrl("https://example.com/a.png")).toBeNull();
  });

  it("round-trips base64 including whitespace", () => {
    const encoded = bytesToBase64(Uint8Array.of(0xfb, 0xff, 0xbf));
    expect(bytesFromBase64(`${encoded.slice(0, 2)}\n${encoded.slice(2)}`)).toEqual(
      Uint8Array.of(0xfb, 0xff, 0xbf),
    );
  });

  it("sniffs common image headers", () => {
    expect(sniffExt(pngBytes)).toBe("png");
    expect(sniffExt(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffExt(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(sniffExt(Uint8Array.of(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("pdf");
    expect(
      sniffExt(Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)),
    ).toBe("webp");
    expect(sniffExt(Uint8Array.of(1, 2, 3))).toBeUndefined();
  });

  it("prefers a recognized content type, then sniffed bytes, then the URL suffix", () => {
    expect(
      imageParts({
        srcUrl: "https://cdn.example/photos/cat%20photo.JPEG?x=1",
        contentType: "image/png; charset=binary",
        bytes: pngBytes,
      }),
    ).toEqual({ name: "cat photo", ext: "png", mime: "image/png" });

    expect(
      imageParts({
        srcUrl: "https://cdn.example/download",
        contentType: "application/octet-stream",
        bytes: pngBytes,
      }),
    ).toEqual({ name: "download", ext: "png", mime: "image/png" });

    expect(
      imageParts({
        srcUrl: "https://cdn.example/a.bmp",
        contentType: "application/octet-stream",
        bytes: Uint8Array.of(1, 2, 3, 4),
      }),
    ).toEqual({ name: "a", ext: "bmp", mime: "application/octet-stream" });
  });
});

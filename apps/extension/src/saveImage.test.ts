import { describe, expect, it } from "vitest";
import { desktopAddItemUrl } from "./desktopClient";
import { bytesToBase64 } from "./imageBytes";
import { LOOPBACK_ORIGIN } from "./loopback";
import type { PageBytesResult } from "./pageImage";
import { saveFromSrcUrl, saveLoadedImage } from "./saveImage";
import {
  APP_NOT_RUNNING_MESSAGE,
  IMAGE_FETCH_FAILED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  LIBRARY_NOT_OPEN_MESSAGE,
  SAVED_MESSAGE,
  UNSUPPORTED_IMAGE_MESSAGE,
} from "./userMessage";

const pageUrl = "https://gallery.example/posts/1";
const imageUrl = "https://cdn.example/photos/cat.png";
const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

describe("save image", () => {
  it("posts image bytes and the source page URL through the shared contract", async () => {
    const seen: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      seen.push(url);
      if (url === imageUrl) {
        expect(init?.credentials).toBe("include");
        return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
      }
      expect(url).toBe(desktopAddItemUrl({ name: "cat", ext: "png", url: pageUrl }));
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBeUndefined();
      const body = init?.body;
      expect(body).toBeInstanceOf(Blob);
      if (body instanceof Blob) {
        expect(new Uint8Array(await body.arrayBuffer())).toEqual(png);
      }
      return new Response(JSON.stringify({ id: "01", name: "cat", ext: "png", url: pageUrl }), {
        status: 201,
      });
    };

    const result = await saveFromSrcUrl(
      { srcUrl: imageUrl, pageUrl },
      { fetch: fetchImpl, readBlobInTab: unusedBlobRead },
    );
    expect(result).toEqual({ ok: true, message: SAVED_MESSAGE });
    expect(seen).toEqual([imageUrl, desktopAddItemUrl({ name: "cat", ext: "png", url: pageUrl })]);
    expect(seen[1]?.startsWith(LOOPBACK_ORIGIN)).toBe(true);
  });

  it("omits ItemMetadata.url when the page URL is not http(s)", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.startsWith(LOOPBACK_ORIGIN)) {
        return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
      }
      expect(new URL(url).searchParams.has("url")).toBe(false);
      return new Response(JSON.stringify({ id: "01", name: "cat", ext: "png", url: null }), {
        status: 201,
      });
    };
    const result = await saveFromSrcUrl(
      { srcUrl: imageUrl, pageUrl: "chrome://newtab/" },
      { fetch: fetchImpl, readBlobInTab: unusedBlobRead },
    );
    expect(result.ok).toBe(true);
  });

  it("does not call the desktop API when the image cannot be fetched", async () => {
    let desktopCalls = 0;
    const fetchImpl = async (input: RequestInfo | URL) => {
      if (String(input).startsWith(LOOPBACK_ORIGIN)) desktopCalls += 1;
      throw new TypeError("Failed to fetch");
    };
    const result = await saveFromSrcUrl(
      { srcUrl: imageUrl, pageUrl },
      { fetch: fetchImpl, readBlobInTab: unusedBlobRead },
    );
    expect(result).toEqual({ ok: false, message: IMAGE_FETCH_FAILED_MESSAGE });
    expect(desktopCalls).toBe(0);
  });

  it("reports a closed library separately from the app being stopped", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      if (!String(input).startsWith(LOOPBACK_ORIGIN)) {
        return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
      }
      return new Response(
        JSON.stringify({ code: "libraryNotOpen", message: "ライブラリが開かれていません" }),
        {
          status: 503,
        },
      );
    };
    const stopped = await saveFromSrcUrl(
      { srcUrl: imageUrl, pageUrl },
      {
        fetch: async (input) => {
          if (String(input).startsWith(LOOPBACK_ORIGIN)) throw new TypeError("Failed to fetch");
          return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
        },
        readBlobInTab: unusedBlobRead,
      },
    );
    const closed = await saveFromSrcUrl(
      { srcUrl: imageUrl, pageUrl },
      { fetch: fetchImpl, readBlobInTab: unusedBlobRead },
    );
    expect(stopped.message).toBe(APP_NOT_RUNNING_MESSAGE);
    expect(closed.message).toBe(LIBRARY_NOT_OPEN_MESSAGE);
  });

  it("decodes a data URL locally and rejects an unsupported extension before posting", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify({ id: "01", name: "image", ext: "png" }), { status: 201 });
    };
    const saved = await saveFromSrcUrl(
      { srcUrl: `data:image/png;base64,${bytesToBase64(png)}`, pageUrl },
      { fetch: fetchImpl, readBlobInTab: unusedBlobRead },
    );
    expect(saved.ok).toBe(true);
    expect(calls).toBe(1);

    const rejected = await saveFromSrcUrl(
      { srcUrl: "https://cdn.example/diagram.bmp", pageUrl },
      {
        fetch: async (input) => {
          if (String(input).startsWith(LOOPBACK_ORIGIN)) {
            throw new Error("desktop should not be called");
          }
          return new Response(Uint8Array.of(1, 2, 3), {
            status: 200,
            headers: { "content-type": "image/bmp" },
          });
        },
        readBlobInTab: unusedBlobRead,
      },
    );
    expect(rejected).toEqual({ ok: false, message: UNSUPPORTED_IMAGE_MESSAGE });
  });

  it("reads blob bytes in the tab and surfaces the transfer limit", async () => {
    const blobUrl = "blob:https://gallery.example/uuid";
    const saved = await saveFromSrcUrl(
      { srcUrl: blobUrl, pageUrl },
      {
        fetch: async (input) => {
          expect(String(input).startsWith(LOOPBACK_ORIGIN)).toBe(true);
          return new Response(JSON.stringify({ id: "01", name: "image", ext: "png" }), {
            status: 201,
          });
        },
        readBlobInTab: async () => ({ ok: true, base64: bytesToBase64(png), mime: "image/png" }),
      },
    );
    expect(saved).toEqual({ ok: true, message: SAVED_MESSAGE });

    const tooLarge = await saveFromSrcUrl(
      { srcUrl: blobUrl, pageUrl },
      {
        fetch: async () => {
          throw new Error("desktop should not be called");
        },
        readBlobInTab: async () => ({ ok: false, reason: "tooLarge" }),
      },
    );
    expect(tooLarge).toEqual({ ok: false, message: IMAGE_TOO_LARGE_MESSAGE });
  });

  it("posts bytes that were already read in the page", async () => {
    const result = await saveLoadedImage(
      { bytes: png, mime: "image/png", ext: "png", name: "inline" },
      pageUrl,
      async (input) => {
        expect(String(input)).toBe(desktopAddItemUrl({ name: "inline", ext: "png", url: pageUrl }));
        return new Response(
          JSON.stringify({ id: "01", name: "inline", ext: "png", url: pageUrl }),
          {
            status: 201,
          },
        );
      },
    );
    expect(result.ok).toBe(true);
  });
});

function unusedBlobRead(): Promise<PageBytesResult> {
  return Promise.reject(new Error("blob read was not expected"));
}

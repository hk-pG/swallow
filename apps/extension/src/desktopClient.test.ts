import { describe, expect, it } from "vitest";
import { desktopAddItemUrl, messageForDesktopResponse, postAddItem } from "./desktopClient";
import {
  APP_NOT_RUNNING_MESSAGE,
  EXTENSION_FORBIDDEN_MESSAGE,
  LIBRARY_NOT_OPEN_MESSAGE,
  SAVE_FAILED_MESSAGE,
} from "./userMessage";

const pageUrl = "https://gallery.example/posts/1?q=1&r=2";
const bytes = Uint8Array.of(1, 2, 3, 4);

describe("desktop client", () => {
  it("posts to IPv4 loopback and stores the page URL, not the image URL", () => {
    const url = desktopAddItemUrl({ name: "cat photo", ext: "png", url: pageUrl });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe("127.0.0.1");
    expect(parsed.port).toBe("41600");
    expect(parsed.searchParams.get("name")).toBe("cat photo");
    expect(parsed.searchParams.get("ext")).toBe("png");
    expect(parsed.searchParams.get("url")).toBe(pageUrl);
  });

  it("maps connection failure and HTTP errors onto the design messages", () => {
    expect(messageForDesktopResponse(403, "not json")).toEqual({
      ok: false,
      message: EXTENSION_FORBIDDEN_MESSAGE,
    });
    expect(
      messageForDesktopResponse(
        403,
        JSON.stringify({
          code: "forbidden",
          message: "この Origin からのリクエストは受け付けません",
        }),
      ),
    ).toEqual({ ok: false, message: EXTENSION_FORBIDDEN_MESSAGE });
    expect(
      messageForDesktopResponse(
        503,
        JSON.stringify({ code: "libraryNotOpen", message: "ライブラリが開かれていません" }),
      ),
    ).toEqual({ ok: false, message: LIBRARY_NOT_OPEN_MESSAGE });
    expect(
      messageForDesktopResponse(503, JSON.stringify({ code: "internal", message: "busy" })),
    ).toEqual({ ok: false, message: "busy" });
    expect(
      messageForDesktopResponse(
        400,
        JSON.stringify({ code: "badRequest", message: "本文が空です" }),
      ),
    ).toEqual({ ok: false, message: "本文が空です" });
    expect(messageForDesktopResponse(500, "<html>nope</html>")).toEqual({
      ok: false,
      message: SAVE_FAILED_MESSAGE,
    });
    expect(messageForDesktopResponse(201, "{")).toEqual({
      ok: false,
      message: SAVE_FAILED_MESSAGE,
    });
    expect(messageForDesktopResponse(201, JSON.stringify({ name: "cat" }))).toEqual({
      ok: false,
      message: SAVE_FAILED_MESSAGE,
    });
  });

  it("returns the created item on 201", () => {
    const result = messageForDesktopResponse(
      201,
      JSON.stringify({ id: "01", name: "cat", ext: "png", url: pageUrl }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.id).toBe("01");
      expect(result.item.url).toBe(pageUrl);
    }
  });

  it("does not retry when the desktop app is not running", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    };
    const result = await postAddItem(
      { bytes, mime: "image/png", query: { ext: "png", url: pageUrl } },
      fetchImpl,
    );
    expect(result).toEqual({ ok: false, message: APP_NOT_RUNNING_MESSAGE });
    expect(calls).toBe(1);
  });

  it("sends the bytes once with the image content type", async () => {
    const bodies: Uint8Array[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = init?.body;
      if (body instanceof Blob) bodies.push(new Uint8Array(await body.arrayBuffer()));
      return new Response(JSON.stringify({ id: "01", name: "image", ext: "png", url: pageUrl }), {
        status: 201,
      });
    };
    const result = await postAddItem(
      { bytes, mime: "image/png", query: { ext: "png", url: pageUrl } },
      fetchImpl,
    );
    expect(result.ok).toBe(true);
    expect(bodies).toEqual([bytes]);
  });
});

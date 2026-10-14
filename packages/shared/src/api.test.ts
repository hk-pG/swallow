import { describe, expect, it } from "vitest";
import { API_PATHS, addItemPath } from "./api";

describe("addItemPath", () => {
  it("omits the query string when nothing is given", () => {
    expect(addItemPath({})).toBe(API_PATHS.addItem);
  });

  it("encodes every given parameter", () => {
    const path = addItemPath({ name: "a b+c", ext: "png", url: "https://example.com/?q=1&r=2" });
    const params = new URL(path, "http://localhost").searchParams;
    expect(params.get("name")).toBe("a b+c");
    expect(params.get("ext")).toBe("png");
    expect(params.get("url")).toBe("https://example.com/?q=1&r=2");
  });
});

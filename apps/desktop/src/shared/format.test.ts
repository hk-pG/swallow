import { describe, expect, it } from "vitest";
import { formatBytes, formatResolution } from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [200 * 1024, "200 KB"],
    [5 * 1024 ** 3, "5.0 GB"],
  ])("%d -> %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("formatResolution", () => {
  it("formats known dimensions", () => {
    expect(formatResolution(640, 480)).toBe("640 × 480");
  });

  it("falls back when dimensions are unknown", () => {
    expect(formatResolution(null, null)).toBe("—");
  });
});

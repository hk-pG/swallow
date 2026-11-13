import { afterEach, describe, expect, it, vi } from "vitest";
import { maskPath } from "./privacy";

const MASK_PATH_CASES = [
  { input: "", expected: "" },
  { input: "images/foo.jpg", expected: "images/foo.jpg" },
  { input: "/a/b/c/d/file.mp4", expected: "…/d/file.mp4" },
  {
    input: "/var/lib/swallow/library/images/abc123/original.mp4",
    expected: "…/abc123/original.mp4",
  },
] as const;

describe("maskPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(MASK_PATH_CASES)("masks $input", ({ input, expected }) => {
    expect(maskPath(input)).toBe(expected);
  });

  it("replaces HOME prefix with tilde", () => {
    vi.stubEnv("HOME", "/Users/tester");
    expect(maskPath("/Users/tester/Library/Logs/dev.swallow.app/foo.log")).toBe(
      "~/Library/Logs/dev.swallow.app/foo.log",
    );
  });

  it("replaces USERPROFILE on Windows-style paths", () => {
    vi.stubEnv("USERPROFILE", "C:\\Users\\tester");
    expect(maskPath("C:\\Users\\tester\\AppData\\Local\\Swallow\\session.log")).toBe(
      "~/AppData\\Local\\Swallow\\session.log",
    );
  });
});

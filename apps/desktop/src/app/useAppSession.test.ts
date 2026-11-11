import { describe, expect, it } from "vitest";
import type { AppSession } from "./useAppSession";

/** Documents the composed session shape for provider and layout wiring. */
describe("useAppSession composition", () => {
  it("groups state into library, browser, and workspace slices", () => {
    type SliceKeys = keyof AppSession;
    const expected: SliceKeys[] = ["library", "browser", "workspace"];
    expect(expected).toHaveLength(3);
    const _typecheck: Record<SliceKeys, true> = {
      library: true,
      browser: true,
      workspace: true,
    };
    expect(_typecheck).toBeDefined();
  });

  it("places catalog providers under the browser slice", () => {
    type BrowserKeys = keyof AppSession["browser"];
    const providerFields: BrowserKeys[] = ["folders", "smartFolders", "tags"];
    expect(providerFields.every((key) => key in { folders: 1, smartFolders: 1, tags: 1 })).toBe(
      true,
    );
  });
});

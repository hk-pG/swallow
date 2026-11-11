import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { updateItems } from "./api";

describe("updateItems", () => {
  it("invokes update_items with camelCase payload", async () => {
    const invokeMock = vi.mocked(invoke).mockResolvedValue(undefined);
    await updateItems("/lib", ["a", "b"], { colorLabel: "green" });
    expect(invokeMock).toHaveBeenCalledWith("update_items", {
      libraryPath: "/lib",
      itemIds: ["a", "b"],
      patch: { colorLabel: "green" },
    });
  });
});

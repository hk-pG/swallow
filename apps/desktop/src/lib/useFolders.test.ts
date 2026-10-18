import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listFolders } = vi.hoisted(() => ({
  listFolders: vi.fn(),
}));

vi.mock("./commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./commands")>();
  return { ...actual, listFolders };
});

import { useFolders } from "./useFolders";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn().mockResolvedValue(false),
}));

describe("useFolders", () => {
  beforeEach(() => {
    listFolders.mockReset();
    listFolders.mockResolvedValue([]);
  });

  it("reloads the tree when libraryPath changes, not when setView identity changes", async () => {
    const invalidateItems = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ setView, libraryPath }) => useFolders({ libraryPath, invalidateItems, setView }),
      { initialProps: { setView: vi.fn(), libraryPath: "/lib" as string | null } },
    );

    await waitFor(() => expect(listFolders).toHaveBeenCalledTimes(1));

    rerender({ setView: vi.fn(), libraryPath: "/lib" });
    await waitFor(() => expect(listFolders).toHaveBeenCalledTimes(1));

    rerender({ setView: vi.fn(), libraryPath: "/other" });
    await waitFor(() => expect(listFolders).toHaveBeenCalledTimes(2));
  });
});

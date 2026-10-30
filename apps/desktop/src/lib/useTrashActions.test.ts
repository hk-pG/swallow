import type { ItemMetadata } from "@swallow/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SELECTION, select } from "./selection";

const { restoreItems, purgeItems, revealItemInExplorer, trashItems, ask } = vi.hoisted(() => ({
  restoreItems: vi.fn(),
  purgeItems: vi.fn(),
  revealItemInExplorer: vi.fn(),
  trashItems: vi.fn(),
  ask: vi.fn(),
}));

vi.mock("./commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./commands")>();
  return {
    ...actual,
    restoreItems,
    purgeItems,
    revealItemInExplorer,
    trashItems,
  };
});

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

import { useTrashActions } from "./useTrashActions";

function sample(id: string, isDeleted = false): ItemMetadata {
  return {
    id,
    name: id,
    ext: "png",
    size: 1,
    width: null,
    height: null,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted,
    colorLabel: null,
  };
}

describe("useTrashActions context helpers", () => {
  beforeEach(() => {
    restoreItems.mockReset().mockResolvedValue(undefined);
    purgeItems.mockReset().mockResolvedValue(undefined);
    revealItemInExplorer.mockReset().mockResolvedValue(undefined);
    trashItems.mockReset().mockResolvedValue(undefined);
    ask.mockReset().mockResolvedValue(true);
  });

  function setup() {
    const setError = vi.fn();
    const clearSelection = vi.fn();
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const onSelectItem = vi.fn();
    const items = [sample("a", true), sample("b")];
    const { result } = renderHook(() =>
      useTrashActions({
        libraryPath: "/lib",
        view: { kind: "trash" },
        visibleIds: items.map((item) => item.id),
        visibleItems: items,
        selection: select(EMPTY_SELECTION, ["a"], "a"),
        selected: items[0] ?? null,
        setSelection: vi.fn(),
        clearSelection,
        onSelectItem,
        invalidate,
        setError,
      }),
    );
    return { result, setError, clearSelection, invalidate, onSelectItem };
  }

  it("restoreItem clears selection and refreshes", async () => {
    const { result, setError, clearSelection, invalidate } = setup();
    await act(async () => {
      await result.current.restoreItem("a");
    });
    expect(restoreItems).toHaveBeenCalledWith("/lib", ["a"]);
    expect(clearSelection).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("purgeItem confirms then purges", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.purgeItem("a");
    });
    expect(ask).toHaveBeenCalled();
    expect(purgeItems).toHaveBeenCalledWith("/lib", ["a"]);
  });

  it("revealInExplorer reports failures via setError", async () => {
    revealItemInExplorer.mockRejectedValueOnce(new Error("boom"));
    const { result, setError } = setup();
    await act(async () => {
      await result.current.revealInExplorer("a");
    });
    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining("エクスプローラーで表示できませんでした"),
    );
  });

  it("editTags selects the item", () => {
    const { result, onSelectItem } = setup();
    act(() => {
      result.current.editTags("b");
    });
    expect(onSelectItem).toHaveBeenCalledWith("b", {});
  });

  it("contextHandlers omit trash on trash view", () => {
    const { result } = setup();
    expect(result.current.contextHandlers.isTrashView).toBe(true);
    expect(result.current.contextHandlers.onContextTrash).toBeUndefined();
    expect(result.current.contextHandlers.onContextRestore).toBe(result.current.restoreItem);
  });

  it("contextHandlers enable trash outside trash view", () => {
    const setError = vi.fn();
    const items = [sample("a"), sample("b")];
    const { result } = renderHook(() =>
      useTrashActions({
        libraryPath: "/lib",
        view: { kind: "all" },
        visibleIds: items.map((item) => item.id),
        visibleItems: items,
        selection: EMPTY_SELECTION,
        selected: null,
        setSelection: vi.fn(),
        clearSelection: vi.fn(),
        onSelectItem: vi.fn(),
        invalidate: vi.fn().mockResolvedValue(undefined),
        setError,
      }),
    );
    expect(result.current.contextHandlers.isTrashView).toBe(false);
    expect(result.current.contextHandlers.onContextTrash).toBeTypeOf("function");
    expect(result.current.contextHandlers.onContextRestore).toBeUndefined();
  });
});

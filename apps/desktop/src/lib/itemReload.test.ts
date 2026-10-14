import type { ItemMetadata } from "@swallow/shared";
import { describe, expect, it, vi } from "vitest";
import { createItemReload } from "./itemReload";

function item(id: string): ItemMetadata {
  return {
    id,
    name: id,
    ext: "png",
    size: 1,
    width: 1,
    height: 1,
    star: 0,
    annotation: "",
    url: null,
    tags: [],
    folders: [],
    isDeleted: false,
    createdAt: 0,
    modifiedAt: 0,
  };
}

describe("createItemReload", () => {
  it("clears items when no library is open", async () => {
    const reload = createItemReload(vi.fn());
    const setItems = vi.fn();
    await reload(null, setItems);
    expect(setItems).toHaveBeenCalledWith([]);
  });

  it("clears stale rows when the library path changes, but not on same-path reload", async () => {
    const listItems = vi.fn().mockResolvedValue([item("a")]);
    const reload = createItemReload(listItems);
    const setItems = vi.fn();

    await reload("/lib", setItems);
    expect(setItems).toHaveBeenCalledWith([]);
    expect(setItems).toHaveBeenCalledWith([item("a")]);
    setItems.mockClear();

    await reload("/lib", setItems);
    expect(setItems).not.toHaveBeenCalledWith([]);
    expect(setItems).toHaveBeenCalledWith([item("a")]);
  });

  it("drops a slower reload for a previous library", async () => {
    let releaseSlow: (items: ItemMetadata[]) => void = () => {};
    const slow = new Promise<ItemMetadata[]>((resolve) => {
      releaseSlow = resolve;
    });
    const listItems = vi
      .fn()
      .mockImplementationOnce(() => slow)
      .mockResolvedValueOnce([item("new")]);

    const reload = createItemReload(listItems);
    const setItems = vi.fn();

    const first = reload("/old", setItems);
    const second = reload("/new", setItems);
    await second;
    releaseSlow([item("old")]);
    await first;

    // path-change clears for /old and /new, then only /new publishes
    expect(setItems).toHaveBeenCalledWith([]);
    expect(setItems).toHaveBeenCalledWith([item("new")]);
    expect(setItems).not.toHaveBeenCalledWith([item("old")]);
  });
});

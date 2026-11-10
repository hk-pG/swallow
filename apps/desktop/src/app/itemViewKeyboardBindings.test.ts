import { describe, expect, it } from "vitest";
import { isNavigationKey } from "../features/items";

/**
 * Global item-view keyboard handling is centralized in useItemViewKeyboard
 * (no separate shortcut registry in apps/desktop). Guard against duplicate
 * navigation key definitions drifting from selection helpers.
 */
const ITEM_VIEW_NAVIGATION_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

describe("item view keyboard bindings", () => {
  it("treats arrow keys as navigation consistently", () => {
    for (const key of ITEM_VIEW_NAVIGATION_KEYS) {
      expect(isNavigationKey(key)).toBe(true);
    }
    expect(isNavigationKey("Enter")).toBe(false);
  });

  it("keeps navigation key labels unique", () => {
    expect(new Set(ITEM_VIEW_NAVIGATION_KEYS).size).toBe(ITEM_VIEW_NAVIGATION_KEYS.length);
  });
});

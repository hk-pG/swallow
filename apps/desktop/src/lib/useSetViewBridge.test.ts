import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSetViewBridge } from "./useSetViewBridge";

describe("useSetViewBridge", () => {
  it("returns a stable setView function across rerenders", () => {
    const { result, rerender } = renderHook(() => useSetViewBridge());
    const first = result.current.setView;
    rerender();
    expect(result.current.setView).toBe(first);
  });
});

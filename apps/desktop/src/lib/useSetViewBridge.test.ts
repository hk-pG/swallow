import { act, renderHook } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSetViewBridge } from "./useSetViewBridge";

describe("useSetViewBridge", () => {
  it("returns a stable setView function across rerenders", () => {
    const { result, rerender } = renderHook(() => useSetViewBridge());
    const first = result.current.setView;
    rerender();
    expect(result.current.setView).toBe(first);
  });

  it("forwards through setViewRef after layout effect bind", () => {
    const target = vi.fn();
    const { result } = renderHook(() => {
      const bridge = useSetViewBridge();
      const [bound, setBound] = useState(false);
      useLayoutEffect(() => {
        bridge.setViewRef.current = target;
        setBound(true);
      });
      return { ...bridge, bound };
    });
    expect(result.current.bound).toBe(true);
    act(() => {
      result.current.setView({ kind: "all" });
    });
    expect(target).toHaveBeenCalledWith({ kind: "all" });
  });
});

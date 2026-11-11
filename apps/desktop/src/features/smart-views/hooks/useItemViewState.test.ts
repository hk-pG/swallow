import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useItemViewState } from "./useItemViewState";

describe("useItemViewState", () => {
  it("starts on the all-items view", () => {
    const { result } = renderHook(() => useItemViewState());
    expect(result.current.view).toEqual({ kind: "all" });
  });

  it("updates view through setView", () => {
    const { result } = renderHook(() => useItemViewState());
    act(() => {
      result.current.setView({ kind: "trash" });
    });
    expect(result.current.view).toEqual({ kind: "trash" });
  });
});

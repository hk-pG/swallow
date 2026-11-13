import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionDiagnosticLog } = vi.hoisted(() => ({
  getSessionDiagnosticLog: vi.fn(),
}));

vi.mock("../api", () => ({
  getSessionDiagnosticLog,
}));

import { useSessionDiagnosticLog } from "./useSessionDiagnosticLog";

describe("useSessionDiagnosticLog", () => {
  beforeEach(() => {
    getSessionDiagnosticLog.mockReset();
  });

  it("loads session log on mount", async () => {
    getSessionDiagnosticLog.mockResolvedValue({
      text: "line one",
      truncated: false,
      maxBytes: 262144,
    });

    const { result } = renderHook(() => useSessionDiagnosticLog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.log?.text).toBe("line one");
    expect(result.current.error).toBeNull();
  });

  it("refresh reloads log", async () => {
    getSessionDiagnosticLog
      .mockResolvedValueOnce({ text: "first", truncated: false, maxBytes: 262144 })
      .mockResolvedValueOnce({ text: "second", truncated: true, maxBytes: 262144 });

    const { result } = renderHook(() => useSessionDiagnosticLog());

    await waitFor(() => {
      expect(result.current.log?.text).toBe("first");
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.log?.text).toBe("second");
    });
    expect(result.current.log?.truncated).toBe(true);
  });

  it("records error when invoke fails", async () => {
    getSessionDiagnosticLog.mockRejectedValue(new Error("invoke failed"));

    const { result } = renderHook(() => useSessionDiagnosticLog());

    await waitFor(() => {
      expect(result.current.error).toBe("invoke failed");
    });
  });
});

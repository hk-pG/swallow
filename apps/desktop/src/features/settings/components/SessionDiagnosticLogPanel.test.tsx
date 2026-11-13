import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("../hooks/useSessionDiagnosticLog", () => ({
  useSessionDiagnosticLog: () => ({
    log: { text: "hello\nworld", truncated: false, maxBytes: 262144 },
    loading: false,
    error: null,
    refresh,
  }),
}));

import { SessionDiagnosticLogPanel } from "./SessionDiagnosticLogPanel";

describe("SessionDiagnosticLogPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows read-only textarea with log text", () => {
    render(<SessionDiagnosticLogPanel />);
    const area = screen.getByLabelText("現在の起動セッションの診断ログ") as HTMLTextAreaElement;
    expect(area.readOnly).toBe(true);
    expect(area.value).toBe("hello\nworld");
  });

  it("calls refresh when reload button clicked", () => {
    refresh.mockClear();
    render(<SessionDiagnosticLogPanel />);
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(refresh).toHaveBeenCalled();
  });

  describe("copy feedback", () => {
    beforeEach(() => {
      vi.stubGlobal("navigator", {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("shows transient copy confirmation with aria-live", async () => {
      render(<SessionDiagnosticLogPanel />);
      fireEvent.click(screen.getByRole("button", { name: "コピー" }));
      expect(await screen.findByRole("button", { name: "コピーしました" })).toBeTruthy();
      expect(document.querySelector("[aria-live='polite']")?.textContent).toBe("コピーしました");
      await waitFor(
        () => {
          expect(screen.getByRole("button", { name: "コピー" })).toBeTruthy();
        },
        { timeout: 2500 },
      );
    });
  });
});

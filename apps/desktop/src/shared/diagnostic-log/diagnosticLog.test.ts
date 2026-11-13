import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCollectingDiagnosticLogger,
  formatDiagnosticMessage,
  getDiagnosticLogger,
  resetDiagnosticLogger,
  setDiagnosticLogger,
} from "./logger";

const error = vi.fn();
const info = vi.fn();

vi.mock("@tauri-apps/plugin-log", () => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info,
  warn: vi.fn(),
  error,
}));

import { createTauriDiagnosticLogger } from "./tauriLogger";

describe("formatDiagnosticMessage", () => {
  it("appends JSON fields", () => {
    expect(formatDiagnosticMessage("preview failed", { itemId: "abc", code: 4 })).toBe(
      'preview failed {"itemId":"abc","code":4}',
    );
  });
});

describe("mock diagnostic logger", () => {
  beforeEach(() => {
    resetDiagnosticLogger();
  });

  it("records via collecting logger", () => {
    const sink: Parameters<typeof createCollectingDiagnosticLogger>[0] = [];
    setDiagnosticLogger(createCollectingDiagnosticLogger(sink));
    getDiagnosticLogger().error("oops", { itemId: "x" });
    expect(sink).toEqual([{ level: "error", message: "oops", fields: { itemId: "x" } }]);
  });
});

describe("tauri diagnostic logger", () => {
  beforeEach(() => {
    error.mockClear();
    info.mockClear();
  });

  it("forwards error with structured suffix", async () => {
    createTauriDiagnosticLogger().error("fail", { itemId: "1" });
    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('fail {"itemId":"1"}');
    });
  });
});

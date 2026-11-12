import { DEFAULT_SETTINGS, type Settings } from "@swallow/shared";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColorSchemeMedia } from "../lib/documentTheme";

const { getSettings, updateSettings } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../api", () => ({
  getSettings,
  updateSettings,
}));

import { installDocumentTheme } from "../lib/documentTheme";
import { useAppearanceSettings } from "./useAppearanceSettings";

function mediaStub(matches: boolean): ColorSchemeMedia & { emit(): void } {
  const listeners = new Set<() => void>();
  return {
    matches,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
}

describe("useAppearanceSettings", () => {
  let root: HTMLDivElement;
  let uninstall: (() => void) | undefined;

  beforeEach(() => {
    getSettings.mockReset();
    updateSettings.mockReset();
    updateSettings.mockResolvedValue(DEFAULT_SETTINGS);
    root = document.createElement("div");
    document.body.append(root);
  });

  afterEach(() => {
    uninstall?.();
    root.remove();
    cleanup();
  });

  it("applies a saved scheme through the document attributes and persists the next choice", async () => {
    getSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      appearance: {
        itemViewMode: "list",
        thumbnailSizeIndex: 1,
        themeId: "paper",
        colorScheme: "dark",
      },
    });
    const media = mediaStub(false);
    uninstall = installDocumentTheme(media, root);

    const { result } = renderHook(() => useAppearanceSettings());

    await waitFor(() => {
      expect(result.current.colorScheme).toBe("dark");
      expect(result.current.itemView.itemViewMode).toBe("list");
      expect(root.getAttribute("data-appearance")).toBe("dark");
    });
    expect(root.getAttribute("data-theme")).toBe("paper");
    expect(result.current.themeId).toBe("paper");

    media.matches = true;
    media.emit();
    expect(root.getAttribute("data-appearance")).toBe("dark");

    act(() => {
      result.current.setColorScheme("light");
    });
    expect(root.getAttribute("data-appearance")).toBe("light");
    expect(updateSettings).toHaveBeenCalledWith({ appearance: { colorScheme: "light" } });

    act(() => {
      result.current.setColorScheme("system");
    });
    expect(root.getAttribute("data-appearance")).toBe("dark");
    expect(updateSettings).toHaveBeenCalledWith({ appearance: { colorScheme: "system" } });

    act(() => {
      result.current.setThemeId("slate");
    });
    expect(root.getAttribute("data-theme")).toBe("slate");
    expect(result.current.colorScheme).toBe("system");
    expect(updateSettings).toHaveBeenCalledWith({ appearance: { themeId: "slate" } });

    act(() => {
      result.current.setThemeId("paper");
    });
    expect(root.getAttribute("data-theme")).toBe("paper");
    expect(root.getAttribute("data-appearance")).toBe("dark");
    expect(updateSettings).toHaveBeenCalledWith({ appearance: { themeId: "paper" } });
  });

  it("falls an unknown saved theme back to ink without changing the scheme", async () => {
    getSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        themeId: "canvas" as Settings["appearance"]["themeId"],
        colorScheme: "light",
      },
    });
    const media = mediaStub(true);
    uninstall = installDocumentTheme(media, root);

    const { result } = renderHook(() => useAppearanceSettings());

    await waitFor(() => {
      expect(result.current.colorScheme).toBe("light");
    });
    expect(result.current.themeId).toBe("ink");
    expect(root.getAttribute("data-theme")).toBe("ink");
    expect(root.getAttribute("data-appearance")).toBe("light");
  });

  it("treats a settings file without theme fields as ink and system", async () => {
    let resolveSettings: (settings: Settings) => void = () => {};
    getSettings.mockReturnValue(
      new Promise<Settings>((resolve) => {
        resolveSettings = resolve;
      }),
    );
    const media = mediaStub(false);
    uninstall = installDocumentTheme(media, root);
    const { result } = renderHook(() => useAppearanceSettings());
    expect(root.getAttribute("data-appearance")).toBe("light");

    await act(async () => {
      resolveSettings({
        ...DEFAULT_SETTINGS,
        appearance: { itemViewMode: "grid", thumbnailSizeIndex: 2 },
      });
    });

    expect(result.current.themeId).toBe("ink");
    expect(result.current.colorScheme).toBe("system");
    expect(root.getAttribute("data-theme")).toBe("ink");
    media.matches = true;
    media.emit();
    expect(root.getAttribute("data-appearance")).toBe("dark");
  });
});

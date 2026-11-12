import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

afterEach(() => {
  cleanup();
});

describe("AppearanceSwitcher", () => {
  it("offers system, light, and dark, plus ink, paper, and slate", () => {
    const html = render(
      <AppearanceSwitcher
        themeId="ink"
        colorScheme="system"
        onThemeIdChange={() => {}}
        onColorSchemeChange={() => {}}
      />,
    ).container.innerHTML;
    expect(html).toContain("外観");
    expect(html).toContain("テーマ");
    expect(html).toContain("システム");
    expect(html).toContain("ライト");
    expect(html).toContain("ダーク");
    expect(html).toContain("インク");
    expect(html).toContain("紙");
    expect(html).toContain("スレート");
    expect(screen.getByRole("button", { name: "システム" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "インク" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "紙" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "ダーク" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("reports the scheme and theme that were chosen", () => {
    const onThemeIdChange = vi.fn();
    const onColorSchemeChange = vi.fn();
    render(
      <AppearanceSwitcher
        themeId="ink"
        colorScheme="light"
        onThemeIdChange={onThemeIdChange}
        onColorSchemeChange={onColorSchemeChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "ダーク" }));
    fireEvent.click(screen.getByRole("button", { name: "紙" }));
    fireEvent.click(screen.getByRole("button", { name: "スレート" }));
    expect(onColorSchemeChange).toHaveBeenCalledWith("dark");
    expect(onThemeIdChange).toHaveBeenNthCalledWith(1, "paper");
    expect(onThemeIdChange).toHaveBeenNthCalledWith(2, "slate");
  });
});

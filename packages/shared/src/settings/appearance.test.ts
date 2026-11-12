import { describe, expect, it } from "vitest";
import {
  COLOR_SCHEME_OPTIONS,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_THEME_ID,
  resolveColorScheme,
  resolveDocumentTheme,
  resolveThemeId,
  THEME_CATALOG,
} from "./appearance";

describe("theme catalog", () => {
  it("offers only ink", () => {
    expect(THEME_CATALOG.map((theme) => theme.id)).toEqual(["ink"]);
    expect(DEFAULT_THEME_ID).toBe("ink");
    expect(COLOR_SCHEME_OPTIONS.map((option) => option.id)).toEqual(["system", "light", "dark"]);
    expect(DEFAULT_COLOR_SCHEME).toBe("system");
  });
});

describe("resolveThemeId", () => {
  it("keeps ink and falls back when the id is missing or unknown", () => {
    expect(resolveThemeId("ink")).toBe("ink");
    expect(resolveThemeId(undefined)).toBe("ink");
    expect(resolveThemeId("paper")).toBe("ink");
    expect(resolveThemeId("slate")).toBe("ink");
    expect(resolveThemeId("")).toBe("ink");
  });
});

describe("resolveColorScheme", () => {
  it("keeps the three schemes and falls back to system", () => {
    expect(resolveColorScheme("system")).toBe("system");
    expect(resolveColorScheme("light")).toBe("light");
    expect(resolveColorScheme("dark")).toBe("dark");
    expect(resolveColorScheme(undefined)).toBe("system");
    expect(resolveColorScheme("blue")).toBe("system");
  });
});

describe("resolveDocumentTheme", () => {
  it("follows the OS only while the scheme is system", () => {
    expect(
      resolveDocumentTheme({ themeId: "ink", colorScheme: "system", prefersDark: false }),
    ).toEqual({ themeId: "ink", appearance: "light" });
    expect(
      resolveDocumentTheme({ themeId: "ink", colorScheme: "system", prefersDark: true }),
    ).toEqual({ themeId: "ink", appearance: "dark" });
  });

  it("forces light or dark over the OS", () => {
    expect(
      resolveDocumentTheme({ themeId: "ink", colorScheme: "light", prefersDark: true }),
    ).toEqual({ themeId: "ink", appearance: "light" });
    expect(
      resolveDocumentTheme({ themeId: "ink", colorScheme: "dark", prefersDark: false }),
    ).toEqual({ themeId: "ink", appearance: "dark" });
  });

  it("applies ink when the saved theme id is unknown", () => {
    expect(
      resolveDocumentTheme({ themeId: "paper", colorScheme: "dark", prefersDark: false }),
    ).toEqual({ themeId: "ink", appearance: "dark" });
    expect(
      resolveDocumentTheme({ themeId: undefined, colorScheme: undefined, prefersDark: true }),
    ).toEqual({ themeId: "ink", appearance: "dark" });
  });
});

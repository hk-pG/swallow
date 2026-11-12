import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_CATALOG } from "@swallow/shared";
import { describe, expect, it } from "vitest";

const stylesDir = dirname(fileURLToPath(import.meta.url));

const OPAQUE_PROPS = [
  "--color-label",
  "--color-tint",
  "--color-danger",
  "--color-star",
  "--color-surface",
  "--color-surface-text",
  "--color-elevated",
  "--color-elevated-text",
  "--sidebar-bg",
] as const;

/** Ground, text, sidebar, accent, danger, and star from the theme design. */
const PALETTE: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {
  paper: {
    light: {
      "--color-surface": "#f7f3ea",
      "--color-label": "#2c2416",
      "--sidebar-bg": "#efe8d8",
      "--color-tint": "#a34b2c",
      "--color-danger": "#a33b32",
      "--color-star": "#c4920a",
    },
    dark: {
      "--color-surface": "#231e18",
      "--color-label": "#f3ead7",
      "--sidebar-bg": "#1c1814",
      "--color-tint": "#e09a6a",
      "--color-danger": "#ff8a7a",
      "--color-star": "#e3b341",
    },
  },
  slate: {
    light: {
      "--color-surface": "#f3f5f7",
      "--color-label": "#1a2330",
      "--sidebar-bg": "#e4eaef",
      "--color-tint": "#2f6f8f",
      "--color-danger": "#c4453c",
      "--color-star": "#d09a10",
    },
    dark: {
      "--color-surface": "#151b22",
      "--color-label": "#e6edf3",
      "--sidebar-bg": "#10161c",
      "--color-tint": "#7eb6d6",
      "--color-danger": "#ff7b72",
      "--color-star": "#e3b341",
    },
  },
};

function readTheme(name: string): string {
  return readFileSync(join(stylesDir, name), "utf8");
}

function themeBlock(css: string, themeId: string, appearance: "light" | "dark"): string {
  const marker = `[data-theme="${themeId}"][data-appearance="${appearance}"]`;
  const start = css.indexOf(marker);
  expect(start, marker).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) {
      found.set(name, value.trim());
    }
  }
  return found;
}

describe("theme stylesheets", () => {
  it("imports every catalog theme and keeps --muted as the weak-text alias", () => {
    const index = readTheme("index.css");
    for (const theme of THEME_CATALOG) {
      expect(index).toContain(`./${theme.id}.css`);
    }
    const tokens = readFileSync(join(stylesDir, "../tokens.css"), "utf8");
    expect(tokens).toContain("--muted: var(--color-secondary-label)");
  });

  it("paints paper and slate in light and dark with the same token names as ink", () => {
    const ink = declarations(themeBlock(readTheme("ink.css"), "ink", "light"));
    expect([...ink.keys()]).toEqual([...OPAQUE_PROPS]);

    for (const themeId of ["paper", "slate"] as const) {
      const css = readTheme(`${themeId}.css`);
      expect(css).not.toMatch(/--muted\s*:/);
      for (const appearance of ["light", "dark"] as const) {
        const block = themeBlock(css, themeId, appearance);
        expect(block).toContain(`color-scheme: ${appearance}`);
        const decls = declarations(block);
        expect([...decls.keys()]).toEqual([...OPAQUE_PROPS]);
        for (const name of OPAQUE_PROPS) {
          expect(decls.get(name)).toMatch(/^#[0-9a-f]{3,8}$/);
        }
        expect(decls.get("--color-surface")).not.toBe(decls.get("--color-elevated"));
        expect(decls.get("--color-surface-text")).toBe(decls.get("--color-label"));
        expect(decls.get("--color-elevated-text")).toBe(decls.get("--color-label"));
        const expected = PALETTE[themeId]?.[appearance];
        expect(expected).toBeDefined();
        for (const [name, value] of Object.entries(expected ?? {})) {
          expect(decls.get(name)).toBe(value);
        }
      }
    }
  });
});

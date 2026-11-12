/** Themes the switcher may offer. Colors stay in CSS. */
export const THEME_CATALOG = [
  { id: "ink", label: "インク", description: "無彩色に近い既定" },
] as const;

export type ThemeId = (typeof THEME_CATALOG)[number]["id"];

export const COLOR_SCHEME_OPTIONS = [
  { id: "system", label: "システム" },
  { id: "light", label: "ライト" },
  { id: "dark", label: "ダーク" },
] as const;

export type ColorScheme = (typeof COLOR_SCHEME_OPTIONS)[number]["id"];

/** light or dark after `system` is resolved. Never persisted. */
export type ResolvedAppearance = "light" | "dark";

export const DEFAULT_THEME_ID: ThemeId = "ink";
export const DEFAULT_COLOR_SCHEME: ColorScheme = "system";

export interface ResolvedDocumentTheme {
  themeId: ThemeId;
  appearance: ResolvedAppearance;
}

export function resolveThemeId(value: unknown): ThemeId {
  const match = THEME_CATALOG.find((theme) => theme.id === value);
  return match ? match.id : DEFAULT_THEME_ID;
}

export function resolveColorScheme(value: unknown): ColorScheme {
  const match = COLOR_SCHEME_OPTIONS.find((option) => option.id === value);
  return match ? match.id : DEFAULT_COLOR_SCHEME;
}

/**
 * Map the saved choice onto the two document attributes.
 * Unknown theme ids become ink. `system` follows `prefersDark`.
 */
export function resolveDocumentTheme(input: {
  themeId: unknown;
  colorScheme: unknown;
  prefersDark: boolean;
}): ResolvedDocumentTheme {
  const themeId = resolveThemeId(input.themeId);
  const colorScheme = resolveColorScheme(input.colorScheme);
  const appearance: ResolvedAppearance =
    colorScheme === "system" ? (input.prefersDark ? "dark" : "light") : colorScheme;
  return { themeId, appearance };
}

import {
  COLOR_SCHEME_OPTIONS,
  type ColorScheme,
  THEME_CATALOG,
  type ThemeId,
} from "@swallow/shared";

export interface AppearanceSwitcherProps {
  themeId: ThemeId;
  colorScheme: ColorScheme;
  disabled?: boolean;
  onThemeIdChange: (themeId: ThemeId) => void;
  onColorSchemeChange: (colorScheme: ColorScheme) => void;
}

export function AppearanceSwitcher({
  themeId,
  colorScheme,
  disabled = false,
  onThemeIdChange,
  onColorSchemeChange,
}: AppearanceSwitcherProps) {
  return (
    <fieldset className="view-mode-toolbar" disabled={disabled} aria-label="表示">
      <span className="view-mode-zoom-label">外観</span>
      <div className="view-mode-toggle">
        {COLOR_SCHEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="view-mode-button"
            aria-pressed={colorScheme === option.id}
            onClick={() => onColorSchemeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="view-mode-zoom-label">テーマ</span>
      <div className="view-mode-toggle">
        {THEME_CATALOG.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className="view-mode-button"
            title={theme.description}
            aria-pressed={themeId === theme.id}
            onClick={() => onThemeIdChange(theme.id)}
          >
            {theme.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

import { DEFAULT_THEME_ID, type ResolvedAppearance, resolveDocumentTheme } from "@swallow/shared";

export const DOCUMENT_THEME_ID = DEFAULT_THEME_ID;

export type DocumentAppearance = ResolvedAppearance;

const SETTLING_CLASS = "swallow-theme-settling";
const SETTLING_STYLE_ATTR = "data-swallow-theme-settling";

export interface ColorSchemeMedia {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export interface DocumentThemeChoice {
  themeId?: unknown;
  colorScheme?: unknown;
}

interface Installation {
  media: ColorSchemeMedia;
  root: HTMLElement;
  choice: DocumentThemeChoice;
  onChange: () => void;
}

let installation: Installation | null = null;

/** Map the OS scheme onto light or dark. `system` uses this; a forced scheme does not. */
export function appearanceFromPrefersDark(prefersDark: boolean): DocumentAppearance {
  return resolveDocumentTheme({
    themeId: undefined,
    colorScheme: "system",
    prefersDark,
  }).appearance;
}

/**
 * Drop transitions while the attributes change so colors do not fade.
 * The class and the style element are gone when this returns.
 */
export function applyDocumentTheme(
  root: HTMLElement,
  appearance: DocumentAppearance,
  themeId: string = DOCUMENT_THEME_ID,
): void {
  const doc = root.ownerDocument;
  const head = doc?.head ?? null;
  const style = doc && head ? doc.createElement("style") : null;
  if (style && head) {
    style.setAttribute(SETTLING_STYLE_ATTR, "");
    style.textContent = `.${SETTLING_CLASS}, .${SETTLING_CLASS} * { transition: none !important; }`;
    head.append(style);
    root.classList.add(SETTLING_CLASS);
  }
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-appearance", appearance);
  if (style) {
    void root.offsetWidth;
    root.classList.remove(SETTLING_CLASS);
    style.remove();
  }
}

function applyInstallation(current: Installation): void {
  const resolved = resolveDocumentTheme({
    themeId: current.choice.themeId,
    colorScheme: current.choice.colorScheme,
    prefersDark: current.media.matches,
  });
  applyDocumentTheme(current.root, resolved.appearance, resolved.themeId);
}

/**
 * Subscribe to the OS scheme and paint `data-theme` / `data-appearance`.
 * A missing choice is ink + system. Returns an unsubscribe.
 */
export function installDocumentTheme(
  media: ColorSchemeMedia,
  root: HTMLElement = document.documentElement,
): () => void {
  if (installation) {
    installation.media.removeEventListener("change", installation.onChange);
  }
  const next: Installation = {
    media,
    root,
    choice: {},
    onChange: () => {},
  };
  next.onChange = () => {
    applyInstallation(next);
  };
  installation = next;
  next.onChange();
  media.addEventListener("change", next.onChange);
  return () => {
    media.removeEventListener("change", next.onChange);
    if (installation === next) installation = null;
  };
}

/** Update the saved choice on the active installation. No-op before install. */
export function setDocumentThemeChoice(choice: DocumentThemeChoice): void {
  if (!installation) return;
  installation.choice = choice;
  installation.onChange();
}

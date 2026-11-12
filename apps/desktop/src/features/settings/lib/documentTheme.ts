export const DOCUMENT_THEME_ID = "ink" as const;

export type DocumentAppearance = "light" | "dark";

const SETTLING_CLASS = "swallow-theme-settling";
const SETTLING_STYLE_ATTR = "data-swallow-theme-settling";

export interface ColorSchemeMedia {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

/** No saved appearance yet. Map only the OS prefers-color-scheme onto light or dark. */
export function appearanceFromPrefersDark(prefersDark: boolean): DocumentAppearance {
  return prefersDark ? "dark" : "light";
}

/**
 * Drop transitions while the attributes change so colors do not fade.
 * The class and the style element are gone when this returns.
 */
export function applyDocumentTheme(root: HTMLElement, appearance: DocumentAppearance): void {
  const doc = root.ownerDocument;
  const head = doc?.head ?? null;
  const style = doc && head ? doc.createElement("style") : null;
  if (style && head) {
    style.setAttribute(SETTLING_STYLE_ATTR, "");
    style.textContent = `.${SETTLING_CLASS}, .${SETTLING_CLASS} * { transition: none !important; }`;
    head.append(style);
    root.classList.add(SETTLING_CLASS);
  }
  root.setAttribute("data-theme", DOCUMENT_THEME_ID);
  root.setAttribute("data-appearance", appearance);
  if (style) {
    void root.offsetWidth;
    root.classList.remove(SETTLING_CLASS);
    style.remove();
  }
}

/** Subscribe to the OS scheme and set ink's two attributes. Returns an unsubscribe. */
export function installDocumentTheme(
  media: ColorSchemeMedia,
  root: HTMLElement = document.documentElement,
): () => void {
  const apply = () => {
    applyDocumentTheme(root, appearanceFromPrefersDark(media.matches));
  };
  apply();
  media.addEventListener("change", apply);
  return () => {
    media.removeEventListener("change", apply);
  };
}

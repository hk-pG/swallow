type HtmlLike = {
  tagName: string;
  isContentEditable?: boolean;
};

function asHtmlLike(target: EventTarget | null): HtmlLike | null {
  if (target == null || typeof target !== "object") return null;
  if (!("tagName" in target)) return null;
  const tagName = (target as { tagName: unknown }).tagName;
  if (typeof tagName !== "string") return null;
  const isContentEditable = Boolean((target as { isContentEditable?: unknown }).isContentEditable);
  return { tagName, isContentEditable };
}

/** Targets where the OS/browser paste/copy menu is still useful. */
export function isEditableContextTarget(target: EventTarget | null): boolean {
  const el = asHtmlLike(target);
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}

/** Blocks the WebView default menu (Inspect, Reload, …) outside editable fields. */
export function suppressDefaultContextMenu(event: Event): void {
  if (isEditableContextTarget(event.target)) return;
  event.preventDefault();
}

/**
 * In production builds, hide the browser-like context menu so right-click
 * cannot open DevTools. Development keeps the default menu on chrome
 * (toolbar, empty areas) for Inspect Element; item cells call preventDefault
 * and show Swallow's own menu instead.
 * Returns an uninstall function.
 */
export function installDisableDefaultContextMenu(isDev = import.meta.env.DEV): () => void {
  if (isDev) return () => {};
  document.addEventListener("contextmenu", suppressDefaultContextMenu);
  return () => {
    document.removeEventListener("contextmenu", suppressDefaultContextMenu);
  };
}

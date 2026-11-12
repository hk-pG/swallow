import { afterEach, describe, expect, it } from "vitest";
import {
  appearanceFromPrefersDark,
  applyDocumentTheme,
  type ColorSchemeMedia,
  DOCUMENT_THEME_ID,
  installDocumentTheme,
} from "./documentTheme";

function mediaStub(matches: boolean): ColorSchemeMedia & {
  emit(): void;
  listenerCount(): number;
} {
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
    listenerCount() {
      return listeners.size;
    },
  };
}

describe("appearanceFromPrefersDark", () => {
  it("maps the OS scheme onto light or dark", () => {
    expect(appearanceFromPrefersDark(false)).toBe("light");
    expect(appearanceFromPrefersDark(true)).toBe("dark");
  });
});

describe("applyDocumentTheme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-appearance");
    document.documentElement.classList.remove("swallow-theme-settling");
    for (const node of document.head.querySelectorAll("[data-swallow-theme-settling]")) {
      node.remove();
    }
  });

  it("sets ink and the appearance, and does not leave the transition lock", () => {
    const root = document.createElement("div");
    document.body.append(root);
    let lockedWhileFlushing = false;
    const descriptor = Object.getOwnPropertyDescriptor(root, "offsetWidth");
    Object.defineProperty(root, "offsetWidth", {
      configurable: true,
      get() {
        lockedWhileFlushing =
          root.classList.contains("swallow-theme-settling") &&
          root.getAttribute("data-theme") === DOCUMENT_THEME_ID &&
          root.getAttribute("data-appearance") === "dark" &&
          document.head.querySelector("[data-swallow-theme-settling]") !== null;
        return 0;
      },
    });

    applyDocumentTheme(root, "dark");

    expect(lockedWhileFlushing).toBe(true);
    expect(root.getAttribute("data-theme")).toBe("ink");
    expect(root.getAttribute("data-appearance")).toBe("dark");
    expect(root.classList.contains("swallow-theme-settling")).toBe(false);
    expect(document.head.querySelector("[data-swallow-theme-settling]")).toBeNull();

    if (descriptor) {
      Object.defineProperty(root, "offsetWidth", descriptor);
    } else {
      Reflect.deleteProperty(root, "offsetWidth");
    }
    root.remove();
  });
});

describe("installDocumentTheme", () => {
  it("follows OS changes and stops after uninstall", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const media = mediaStub(false);

    const uninstall = installDocumentTheme(media, root);
    expect(root.getAttribute("data-theme")).toBe("ink");
    expect(root.getAttribute("data-appearance")).toBe("light");

    media.matches = true;
    media.emit();
    expect(root.getAttribute("data-appearance")).toBe("dark");

    uninstall();
    expect(media.listenerCount()).toBe(0);
    media.matches = false;
    media.emit();
    expect(root.getAttribute("data-appearance")).toBe("dark");

    root.remove();
  });
});

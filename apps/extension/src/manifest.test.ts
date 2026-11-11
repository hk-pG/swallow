import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAVE_MENU_TITLE } from "./userMessage";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("extension manifest", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(extensionRoot, "public/manifest.json"), "utf8"),
  ) as {
    permissions?: string[];
    host_permissions?: string[];
    minimum_chrome_version?: string;
    browser_specific_settings?: unknown;
    action?: { default_title?: string; default_popup?: string };
    background?: { service_worker?: string; type?: string };
  };

  it("is a Chrome MV3 save extension with the design host permissions", () => {
    expect(manifest.minimum_chrome_version).toBe("120");
    expect(manifest.browser_specific_settings).toBeUndefined();
    expect(manifest.permissions).toEqual(["scripting", "notifications", "contextMenus"]);
    expect(manifest.host_permissions).toEqual([
      "http://127.0.0.1:41600/*",
      "https://*/*",
      "http://*/*",
    ]);
    expect(manifest.background).toEqual({ service_worker: "background.js", type: "module" });
    expect(manifest.action?.default_popup).toBe("popup.html");
    expect(manifest.action?.default_title).toBe(SAVE_MENU_TITLE);
    expect(SAVE_MENU_TITLE).toBe("Swallow に保存");
  });

  it("loads the popup as a module without an inline script", () => {
    const html = readFileSync(path.join(extensionRoot, "public/popup.html"), "utf8");
    expect(html).toContain('src="./popup.js"');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });
});

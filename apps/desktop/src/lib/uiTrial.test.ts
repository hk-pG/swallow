import { afterEach, describe, expect, it } from "vitest";
import {
  applyUiTrialToDocument,
  DEFAULT_UI_TRIAL,
  parseUiTrial,
  readUiTrial,
  writeUiTrial,
} from "./uiTrial";

describe("parseUiTrial", () => {
  it("accepts known values and defaults otherwise", () => {
    expect(parseUiTrial("apple-hig")).toBe("apple-hig");
    expect(parseUiTrial("off")).toBe("off");
    expect(parseUiTrial(null)).toBe(DEFAULT_UI_TRIAL);
    expect(parseUiTrial("unknown")).toBe(DEFAULT_UI_TRIAL);
  });
});

describe("uiTrial persistence", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-ui-trial");
  });

  it("reads and writes localStorage, clearing when back to default", () => {
    writeUiTrial("off");
    expect(localStorage.getItem("swallow.uiTrial")).toBe("off");
    expect(readUiTrial()).toBe("off");

    writeUiTrial("apple-hig");
    expect(localStorage.getItem("swallow.uiTrial")).toBeNull();
    expect(readUiTrial()).toBe("apple-hig");
  });

  it("toggles data-ui-trial on the document element", () => {
    applyUiTrialToDocument("apple-hig");
    expect(document.documentElement.getAttribute("data-ui-trial")).toBe("apple-hig");
    applyUiTrialToDocument("off");
    expect(document.documentElement.hasAttribute("data-ui-trial")).toBe(false);
  });
});

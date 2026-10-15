import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installDisableDefaultContextMenu,
  isEditableContextTarget,
  suppressDefaultContextMenu,
} from "./disableDefaultContextMenu";

function fakeEvent(target: object | null): Event {
  return {
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  } as Event;
}

describe("isEditableContextTarget", () => {
  it("allows input, textarea, and contenteditable", () => {
    expect(isEditableContextTarget({ tagName: "INPUT" } as EventTarget)).toBe(true);
    expect(isEditableContextTarget({ tagName: "TEXTAREA" } as EventTarget)).toBe(true);
    expect(
      isEditableContextTarget({
        tagName: "DIV",
        isContentEditable: true,
      } as EventTarget),
    ).toBe(true);
  });

  it("rejects non-editable elements and null", () => {
    expect(isEditableContextTarget({ tagName: "DIV" } as EventTarget)).toBe(false);
    expect(isEditableContextTarget(null)).toBe(false);
  });
});

describe("suppressDefaultContextMenu", () => {
  it("prevents default outside editable targets", () => {
    const event = fakeEvent({ tagName: "DIV" });
    suppressDefaultContextMenu(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves editable targets alone", () => {
    const event = fakeEvent({ tagName: "INPUT" });
    suppressDefaultContextMenu(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("installDisableDefaultContextMenu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing in development", () => {
    const addEventListener = vi.fn();
    vi.stubGlobal("document", { addEventListener, removeEventListener: vi.fn() });
    const uninstall = installDisableDefaultContextMenu(true);
    expect(addEventListener).not.toHaveBeenCalled();
    uninstall();
  });

  it("registers and uninstalls the listener in production", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("document", { addEventListener, removeEventListener });

    const uninstall = installDisableDefaultContextMenu(false);
    expect(addEventListener).toHaveBeenCalledWith("contextmenu", suppressDefaultContextMenu);

    uninstall();
    expect(removeEventListener).toHaveBeenCalledWith("contextmenu", suppressDefaultContextMenu);
  });
});

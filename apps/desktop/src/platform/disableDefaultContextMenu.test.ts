import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installDisableDefaultContextMenu,
  isEditableContextTarget,
  suppressDefaultContextMenu,
} from "./disableDefaultContextMenu";

function asTarget(value: object): EventTarget {
  return value as unknown as EventTarget;
}

function fakeEvent(target: object | null): Event {
  let prevented = false;
  return {
    target,
    get defaultPrevented() {
      return prevented;
    },
    preventDefault() {
      prevented = true;
    },
  } as Event;
}

describe("isEditableContextTarget", () => {
  it("allows input, textarea, and contenteditable", () => {
    expect(isEditableContextTarget(asTarget({ tagName: "INPUT" }))).toBe(true);
    expect(isEditableContextTarget(asTarget({ tagName: "TEXTAREA" }))).toBe(true);
    expect(
      isEditableContextTarget(
        asTarget({
          tagName: "DIV",
          isContentEditable: true,
        }),
      ),
    ).toBe(true);
  });

  it("rejects non-editable elements and null", () => {
    expect(isEditableContextTarget(asTarget({ tagName: "DIV" }))).toBe(false);
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

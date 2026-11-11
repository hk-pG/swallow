import { describe, expect, it, vi } from "vitest";

const { installDisableDefaultContextMenu } = vi.hoisted(() => ({
  installDisableDefaultContextMenu: vi.fn(() => () => {}),
}));

vi.mock("../platform/disableDefaultContextMenu", () => ({
  installDisableDefaultContextMenu,
}));

import { bootstrapApp } from "./bootstrap";

describe("bootstrapApp", () => {
  it("delegates to installDisableDefaultContextMenu", () => {
    installDisableDefaultContextMenu.mockClear();
    bootstrapApp();
    expect(installDisableDefaultContextMenu).toHaveBeenCalledTimes(1);
  });

  it("does not guard against repeat calls (each bootstrap registers again)", () => {
    installDisableDefaultContextMenu.mockClear();
    bootstrapApp();
    bootstrapApp();
    expect(installDisableDefaultContextMenu).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";
import { AppLayout } from "../AppLayout";
import { AppLayoutInspector } from "./AppLayoutInspector";
import { AppLayoutMain } from "./AppLayoutMain";
import { AppLayoutOverlays } from "./AppLayoutOverlays";
import { AppLayoutSidebar } from "./AppLayoutSidebar";

describe("AppLayout sections", () => {
  it("exports a root layout and localized section components", () => {
    expect(typeof AppLayout).toBe("function");
    expect(typeof AppLayoutSidebar).toBe("function");
    expect(typeof AppLayoutMain).toBe("function");
    expect(typeof AppLayoutInspector).toBe("function");
    expect(typeof AppLayoutOverlays).toBe("function");
  });
});

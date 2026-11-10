import type { ItemView } from "@swallow/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FolderSection, useFoldersApi } from "../features/folders";
import { AppProviders } from "./AppProviders";
import { SidebarSections, sidebarSections } from "./sidebarRegistry";
import { asAppSession, minimalProviderSession } from "./testSessionFixtures";

afterEach(() => cleanup());

const defaultView: ItemView = { kind: "all" };

function FoldersApiProbe() {
  const api = useFoldersApi();
  return <span data-testid="probe">{api.folders.length}</span>;
}

describe("AppProviders wiring", () => {
  it("throws when a sidebar consumer mounts outside providers", () => {
    expect(() =>
      render(
        <FolderSection libraryPath={null} view={defaultView} onViewChange={() => {}} disabled />,
      ),
    ).toThrow(/FoldersProvider/);
  });

  it("mounts every registered sidebar section inside AppProviders", () => {
    const session = asAppSession(minimalProviderSession());
    const { container } = render(
      <AppProviders session={session}>
        <SidebarSections libraryPath={null} view={defaultView} onViewChange={() => {}} disabled />
      </AppProviders>,
    );
    expect(container.querySelector(".layout, .sidebar-section, nav, button")).toBeTruthy();
    expect(sidebarSections.length).toBeGreaterThan(0);
  });

  it("mounts provider-backed sections when the library is closed (disabled)", () => {
    const session = asAppSession(minimalProviderSession());
    render(
      <AppProviders session={session}>
        <SidebarSections libraryPath={null} view={defaultView} onViewChange={() => {}} disabled />
      </AppProviders>,
    );
    expect(screen.getByRole("heading", { name: "ビュー" })).toBeTruthy();
  });

  it("mounts provider-backed sections when the library is open", () => {
    const session = asAppSession(minimalProviderSession());
    render(
      <AppProviders session={session}>
        <SidebarSections
          libraryPath="/tmp/lib"
          view={defaultView}
          onViewChange={() => {}}
          disabled={false}
        />
      </AppProviders>,
    );
    expect(screen.getByRole("heading", { name: "ビュー" })).toBeTruthy();
  });

  it("exposes folder API to descendants", () => {
    const session = asAppSession(minimalProviderSession());
    render(
      <AppProviders session={session}>
        <FoldersApiProbe />
      </AppProviders>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("0");
  });
});

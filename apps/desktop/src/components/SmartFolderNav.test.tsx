import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SmartFolderNav } from "./SmartFolderNav";

const noopApi = {
  smartFolders: [],
  onCreate: async () => {},
  onRename: async () => {},
  onUpdateCriteria: async () => {},
  onDelete: async () => {},
};

describe("SmartFolderNav", () => {
  afterEach(() => cleanup());

  it("renders section title and create form without row delete buttons", () => {
    const { container } = render(
      <SmartFolderNav
        smartFolders={[
          {
            id: "sf1",
            name: "High stars",
            criteria: {
              query: "",
              tags: [],
              tagMatch: "all",
              folderId: null,
              minStar: 3,
            },
          },
        ]}
        folders={[]}
        libraryTags={["landscape"]}
        view={{ kind: "smartFolder", smartFolderId: "sf1" }}
        onChange={() => {}}
        mutations={noopApi}
      />,
    );
    expect(container.textContent).toContain("スマートフォルダ");
    expect(container.textContent).toContain("High stars");
    expect(container.textContent).toContain("作成");
    expect(container.querySelector(".sidebar-icon-button")).toBeNull();
  });

  it("does not show criteria editor until opened from the context menu", () => {
    render(
      <SmartFolderNav
        smartFolders={[
          {
            id: "sf1",
            name: "High stars",
            criteria: {
              query: "",
              tags: [],
              tagMatch: "all",
              folderId: null,
              minStar: 3,
            },
          },
        ]}
        folders={[]}
        libraryTags={["landscape"]}
        view={{ kind: "smartFolder", smartFolderId: "sf1" }}
        onChange={() => {}}
        mutations={noopApi}
      />,
    );
    expect(screen.queryByText("条件を保存")).toBeNull();
    fireEvent.contextMenu(screen.getByRole("button", { name: "High stars" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "条件を編集…" }));
    expect(screen.getByText("条件を保存")).toBeTruthy();
  });
});

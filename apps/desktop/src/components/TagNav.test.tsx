import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { ask } = vi.hoisted(() => ({
  ask: vi.fn(async () => true),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

import { TagNav } from "./TagNav";

describe("TagNav", () => {
  afterEach(() => cleanup());

  it("opens tag actions from the context menu instead of inline controls", async () => {
    const removeTag = vi.fn(async () => {});
    render(
      <TagNav
        libraryTags={{
          tags: ["landscape"],
          groups: [{ id: "g1", name: "Nature", tags: ["landscape"] }],
        }}
        view={{ kind: "tag", tag: "landscape" }}
        onChange={() => {}}
        mutations={{
          addTag: async () => {},
          removeTag,
          createGroup: async () => {},
          deleteGroup: async () => {},
          setTagGroup: async () => {},
        }}
      />,
    );
    expect(screen.queryByLabelText("landscape のグループ")).toBeNull();
    fireEvent.contextMenu(screen.getByRole("button", { name: "landscape" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "タグを削除" }));
    await waitFor(() => {
      expect(removeTag).toHaveBeenCalledWith("landscape");
    });
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TagNav } from "./TagNav";

const mutations = {
  addTag: async () => {},
  removeTag: async () => {},
  createGroup: async () => {},
  deleteGroup: async () => {},
  setTagGroup: async () => {},
};

const libraryTags = {
  tags: ["landscape", "night"],
  groups: [{ id: "g1", name: "場所", tags: ["landscape"] }],
};

describe("TagNav", () => {
  it("hides create forms and row editors until they are needed", () => {
    const html = renderToStaticMarkup(
      <TagNav
        libraryTags={libraryTags}
        view={{ kind: "all" }}
        onChange={() => {}}
        mutations={mutations}
      />,
    );
    expect(html).toContain("追加");
    expect(html).toContain("landscape");
    expect(html).not.toContain("タグを追加");
    expect(html).not.toContain("tag-group-select");
  });

  it("puts group assignment and delete under the selected tag", () => {
    const html = renderToStaticMarkup(
      <TagNav
        libraryTags={libraryTags}
        view={{ kind: "tag", tag: "landscape" }}
        onChange={() => {}}
        mutations={mutations}
      />,
    );
    expect(html).toContain("sidebar-detail");
    expect(html).toContain("tag-group-select");
    expect(html).toContain("削除");
    expect(html.match(/tag-group-select/g)).toHaveLength(1);
  });
});

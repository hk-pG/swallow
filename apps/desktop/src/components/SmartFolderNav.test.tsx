import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SmartFolderNav } from "./SmartFolderNav";

const noopApi = {
  smartFolders: [],
  onCreate: async () => {},
  onRename: async () => {},
  onUpdateCriteria: async () => {},
  onDelete: async () => {},
};

describe("SmartFolderNav", () => {
  it("keeps create in the header and edits under the selected row", () => {
    const html = renderToStaticMarkup(
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
    expect(html).toContain("スマートフォルダ");
    expect(html).toContain("High stars");
    expect(html).toContain("追加");
    expect(html).toContain("sidebar-detail");
    expect(html).toContain("条件を保存");
    expect(html).not.toContain('placeholder="名前"');
  });
});

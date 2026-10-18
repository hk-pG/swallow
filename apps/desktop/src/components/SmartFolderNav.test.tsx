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
  it("renders section title and create form", () => {
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
    expect(html).toContain("作成");
  });
});

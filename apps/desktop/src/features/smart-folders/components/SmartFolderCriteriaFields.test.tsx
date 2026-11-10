import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SmartFolderCriteriaFields } from "./SmartFolderCriteriaFields";

describe("SmartFolderCriteriaFields", () => {
  it("renders footer note when provided", () => {
    const html = renderToStaticMarkup(
      <SmartFolderCriteriaFields
        criteria={{ query: "", tags: [], tagMatch: "all", folderId: null, minStar: null }}
        folders={[]}
        libraryTags={[]}
        onChange={() => {}}
        footerNote="EXIF は未対応"
      />,
    );
    expect(html).toContain("EXIF は未対応");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarContextMenu } from "./SidebarContextMenu";

describe("SidebarContextMenu", () => {
  it("renders menu items with danger styling", () => {
    const html = renderToStaticMarkup(
      <SidebarContextMenu
        state={{ x: 12, y: 24 }}
        ariaLabel="テスト"
        items={[
          { label: "名前を変更…", onClick: () => {} },
          { label: "削除", danger: true, onClick: () => {} },
        ]}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("item-context-menu");
    expect(html).toContain("名前を変更…");
    expect(html).toContain("item-context-menu-item danger");
  });
});

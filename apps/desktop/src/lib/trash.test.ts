import { describe, expect, it } from "vitest";
import { purgeConfirmMessage } from "./trash";

describe("purgeConfirmMessage", () => {
  it("names a single item with its extension", () => {
    expect(purgeConfirmMessage([{ name: "cat", ext: "png" }])).toBe(
      "「cat.png」を完全に削除します。ファイルも削除され、元に戻せません。",
    );
  });

  it("counts multiple items", () => {
    const items = [
      { name: "a", ext: "png" },
      { name: "b", ext: "jpg" },
    ];
    expect(purgeConfirmMessage(items)).toBe(
      "2 件のアイテムを完全に削除します。ファイルも削除され、元に戻せません。",
    );
  });
});

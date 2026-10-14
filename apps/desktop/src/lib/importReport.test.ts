import type { ImportReport, ItemMetadata } from "@swallow/shared";
import { describe, expect, it } from "vitest";
import { fileName, summarizeImport } from "./importReport";

const item = { id: "a" } as ItemMetadata;

describe("summarizeImport", () => {
  it("omits failures when everything succeeded", () => {
    const report: ImportReport = { imported: [item, item], failed: [] };
    expect(summarizeImport(report)).toBe("2 件を取り込みました");
  });

  it("mentions partial failures", () => {
    const report: ImportReport = {
      imported: [item],
      failed: [{ path: "a.txt", reason: "unsupportedExtension", message: "" }],
    };
    expect(summarizeImport(report)).toBe("1 件を取り込みました（1 件は失敗）");
  });
});

describe("fileName", () => {
  it("handles both separators", () => {
    expect(fileName("C:\\images\\a.png")).toBe("a.png");
    expect(fileName("/home/u/b.jpg")).toBe("b.jpg");
  });
});

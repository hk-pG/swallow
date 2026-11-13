import type { ItemMetadata } from "@swallow/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCollectingDiagnosticLogger,
  resetDiagnosticLogger,
  setDiagnosticLogger,
} from "../../../shared/diagnostic-log";
import type { QuickLookTarget } from "../lib/quickLook";
import { QuickLook } from "./QuickLook";

vi.mock("../../items", () => ({
  ItemMediaPreview: ({ onError }: { onError?: () => void }) => (
    <button type="button" onClick={() => onError?.()}>
      trigger-preview-error
    </button>
  ),
  itemFullPreviewUrl: () => "thumb://localhost/x?full=1",
}));

function item(id: string): ItemMetadata {
  return {
    id,
    name: "clip",
    ext: "mp4",
    size: 2048,
    width: 1920,
    height: 1080,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    colorLabel: null,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
  };
}

function target(): QuickLookTarget {
  const first = item("v1");
  const playlist = [first];
  return {
    item: first,
    playlist,
    index: 0,
    isMultiSelection: false,
  };
}

describe("QuickLook preview failure logging", () => {
  afterEach(() => {
    cleanup();
    resetDiagnosticLogger();
  });

  it("records structured quick-look failure when preview errors", async () => {
    const sink: Parameters<typeof createCollectingDiagnosticLogger>[0] = [];
    setDiagnosticLogger(createCollectingDiagnosticLogger(sink));

    render(
      <QuickLook
        libraryPath="/lib"
        target={target()}
        scaleMode="fit"
        onScaleModeChange={() => {}}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );

    screen.getByRole("button", { name: "trigger-preview-error" }).click();

    expect(sink).toHaveLength(1);
    expect(sink[0]?.message).toBe("preview failed");
    expect(sink[0]?.fields).toMatchObject({
      source: "quick-look",
      component: "QuickLook",
      itemId: "v1",
      ext: "mp4",
      fileSize: 2048,
      urlScheme: "thumb",
    });
  });
});

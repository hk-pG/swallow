import type { ItemMetadata } from "@swallow/shared";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useItemViewKeyboard } from "./useItemViewKeyboard";

afterEach(cleanup);

function sample(id: string): ItemMetadata {
  return {
    id,
    name: id,
    ext: "png",
    size: 1,
    width: null,
    height: null,
    tags: [],
    folders: [],
    annotation: "",
    star: 0,
    url: null,
    createdAt: 0,
    modifiedAt: 0,
    isDeleted: false,
    colorLabel: null,
  };
}

function Harness({
  onSelect,
  onSelectAll,
  onClearSelection,
  onDelete,
  onQuickLook,
  onEscape,
}: {
  onSelect: (id: string, modifiers: { range?: boolean; toggle?: boolean }) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete?: () => void;
  onQuickLook?: (id: string) => void;
  onEscape?: () => void;
}) {
  const items = [sample("a"), sample("b"), sample("c")];
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useItemViewKeyboard({
    items,
    containerRef,
    columnCount: () => 1,
    onSelect,
    onSelectAll,
    onClearSelection,
    onDelete,
    onQuickLook,
    onEscape,
  });
  return (
    <div ref={containerRef}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-id={item.id}
          onKeyDown={(e) => handleKeyDown(e, item.id)}
        >
          {item.name}
        </button>
      ))}
    </div>
  );
}

describe("useItemViewKeyboard", () => {
  it("moves focus with arrows and supports Shift range", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Harness onSelect={onSelect} onSelectAll={() => {}} onClearSelection={() => {}} />,
    );
    const view = within(container);
    fireEvent.keyDown(view.getByRole("button", { name: "a" }), { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith("b", { range: false });

    onSelect.mockClear();
    fireEvent.keyDown(view.getByRole("button", { name: "a" }), {
      key: "ArrowDown",
      shiftKey: true,
    });
    expect(onSelect).toHaveBeenCalledWith("b", { range: true });
  });

  it("selects all, opens Quick Look, deletes, and clears with Escape", () => {
    const onSelectAll = vi.fn();
    const onClearSelection = vi.fn();
    const onEscape = vi.fn();
    const onDelete = vi.fn();
    const onQuickLook = vi.fn();
    const { container } = render(
      <Harness
        onSelect={() => {}}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
        onQuickLook={onQuickLook}
        onEscape={onEscape}
      />,
    );
    const cell = within(container).getByRole("button", { name: "a" });

    fireEvent.keyDown(cell, { key: "a", metaKey: true });
    expect(onSelectAll).toHaveBeenCalled();

    fireEvent.keyDown(cell, { key: " " });
    expect(onQuickLook).toHaveBeenCalledWith("a");

    fireEvent.keyDown(cell, { key: "Delete" });
    expect(onDelete).toHaveBeenCalled();

    fireEvent.keyDown(cell, { key: "Escape" });
    expect(onClearSelection).toHaveBeenCalled();
    expect(onEscape).toHaveBeenCalled();
  });
});

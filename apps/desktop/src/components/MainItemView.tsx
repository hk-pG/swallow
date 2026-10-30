import type { ItemId, ItemMetadata, ItemViewMode } from "@swallow/shared";
import type { Selection, SelectModifiers } from "../lib/selection";
import type { ItemViewContextHandlers } from "../lib/useItemContextMenu";
import { ItemGrid } from "./ItemGrid";
import { ItemList } from "./ItemList";

export type MainEmptyState = "no-library" | "no-items" | "no-matches";

/** Returns which empty placeholder to show, or null when items should render. */
export function resolveMainEmptyState(
  libraryPath: string | null,
  itemCount: number,
  visibleCount: number,
): MainEmptyState | null {
  if (libraryPath === null) return "no-library";
  if (itemCount === 0) return "no-items";
  if (visibleCount === 0) return "no-matches";
  return null;
}

interface MainItemViewProps extends ItemViewContextHandlers {
  libraryPath: string | null;
  itemCount: number;
  visibleItems: ItemMetadata[];
  itemViewMode: ItemViewMode;
  selection: Selection;
  recentLibraries: string[];
  onSelect: (id: ItemId, modifiers: SelectModifiers) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete?: () => void;
  onQuickLook?: (id: ItemId) => void;
  onCreateLibrary: () => void;
  onOpenLibrary: () => void;
  onOpenRecent: (path: string) => void;
}

export function MainItemView({
  libraryPath,
  itemCount,
  visibleItems,
  itemViewMode,
  selection,
  recentLibraries,
  onSelect,
  onSelectAll,
  onClearSelection,
  onDelete,
  onQuickLook,
  onCreateLibrary,
  onOpenLibrary,
  onOpenRecent,
  isTrashView = false,
  onContextTrash,
  onContextRestore,
  onContextPurge,
  onContextEditTags,
  onContextRevealInExplorer,
}: MainItemViewProps) {
  const emptyState = resolveMainEmptyState(libraryPath, itemCount, visibleItems.length);
  const itemContext: ItemViewContextHandlers = {
    isTrashView,
    onContextTrash,
    onContextRestore,
    onContextPurge,
    onContextEditTags,
    onContextRevealInExplorer,
  };

  switch (emptyState) {
    case "no-library":
      return (
        <section className="grid-placeholder">
          <div className="empty-library">
            <p>ライブラリが開かれていません</p>
            <div className="library-actions">
              <button type="button" className="push-button" onClick={onCreateLibrary}>
                新規ライブラリを作成
              </button>
              <button type="button" className="push-button" onClick={onOpenLibrary}>
                ライブラリを開く
              </button>
            </div>
            {recentLibraries.length > 0 && (
              <div className="recent-libraries">
                <p>最近使ったライブラリ</p>
                <ul>
                  {recentLibraries.map((path) => (
                    <li key={path}>
                      <button
                        type="button"
                        className="text-button link"
                        title={path}
                        onClick={() => onOpenRecent(path)}
                      >
                        {path}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      );
    case "no-items":
      return <section className="grid-placeholder">ファイルをドロップして取り込み</section>;
    case "no-matches":
      return <section className="grid-placeholder">該当するアイテムがありません</section>;
    case null: {
      if (libraryPath === null) return null;
      const listProps = {
        libraryPath,
        items: visibleItems,
        selection,
        onSelect,
        onSelectAll,
        onClearSelection,
        onDelete,
        onQuickLook,
        ...itemContext,
      };
      return itemViewMode === "list" ? <ItemList {...listProps} /> : <ItemGrid {...listProps} />;
    }
  }
}

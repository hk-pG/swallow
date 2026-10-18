import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useRef } from "react";
import { AppInfo } from "./components/AppInfo";
import { FolderAssignControl } from "./components/FolderAssignControl";
import { Inspector } from "./components/Inspector";
import { ItemGrid } from "./components/ItemGrid";
import { QuickLook } from "./components/QuickLook";
import { AdvancedSearch } from "./components/AdvancedSearch";
import { TrashActions } from "./components/TrashActions";
import { ImportReportBanner } from "./ImportReportBanner";
import { purgeItems, restoreItems, revealItemInExplorer } from "./lib/commands";
import { focusInspectorTagInput } from "./lib/focusInspector";
import { purgeConfirmMessage } from "./lib/trash";
import { useAssetImport } from "./lib/useAssetImport";
import { useFolders } from "./lib/useFolders";
import { useItemBrowser } from "./lib/useItemBrowser";
import { useItemList } from "./lib/useItemList";
import { useLibrarySession } from "./lib/useLibrarySession";
import { useQuickLook } from "./lib/useQuickLook";
import { useSetViewBridge } from "./lib/useSetViewBridge";
import { useSmartFolders } from "./lib/useSmartFolders";
import { useTags } from "./lib/useTags";
import { useTrashActions } from "./lib/useTrashActions";
import { FoldersProvider } from "./sidebar/FoldersContext";
import { SmartFoldersProvider } from "./sidebar/SmartFoldersContext";
import { SidebarSections } from "./sidebar/sections";
import { TagsProvider } from "./sidebar/TagsContext";

export function App() {
  const session = useLibrarySession();
  const { libraryPath } = session;
  const { items, invalidate, saveItem } = useItemList(libraryPath);

  const { setView, setViewRef } = useSetViewBridge();
  const folders = useFolders({
    libraryPath,
    invalidateItems: invalidate,
    setView,
  });
  const tags = useTags({
    libraryPath,
    invalidateItems: invalidate,
    setView,
  });
  const smartFolders = useSmartFolders({ libraryPath, setView });
  const browser = useItemBrowser(items, folders.folders, smartFolders.smartFolders);
  setViewRef.current = browser.setView;

  const contentRef = useRef<HTMLElement>(null);
  const refreshAfterImport = async () => {
    await invalidate();
    await folders.reload();
  };
  const assetImport = useAssetImport(libraryPath, contentRef, refreshAfterImport);
  const quickLook = useQuickLook(browser.selection, browser.visibleIds, browser.visibleItems);
  const trash = useTrashActions({
    libraryPath,
    view: browser.view,
    visibleIds: browser.visibleIds,
    selection: browser.selection,
    selected: browser.selected,
    setSelection: browser.setSelection,
    clearSelection: browser.clearSelection,
    invalidate,
    setError: session.setError,
  });

  const isTrashView = browser.view.kind === "trash";

  const handleContextRevealInExplorer = useCallback(
    async (itemId: string) => {
      if (!libraryPath) return;
      try {
        await revealItemInExplorer(libraryPath, itemId);
        session.setError(null);
      } catch (e) {
        session.setError(`エクスプローラーで表示できませんでした: ${e}`);
      }
    },
    [libraryPath, session.setError],
  );

  const handleContextEditTags = useCallback(
    (itemId: string) => {
      browser.handleSelect(itemId, {});
      requestAnimationFrame(() => focusInspectorTagInput());
    },
    [browser.handleSelect],
  );

  const handleContextRestore = useCallback(
    async (itemId: string) => {
      if (!libraryPath) return;
      try {
        await restoreItems(libraryPath, [itemId]);
        session.setError(null);
        browser.clearSelection();
        await invalidate();
      } catch (e) {
        session.setError(`復元できませんでした: ${e}`);
      }
    },
    [libraryPath, browser.clearSelection, invalidate, session.setError],
  );

  const handleContextPurge = useCallback(
    async (itemId: string) => {
      if (!libraryPath) return;
      const item = browser.visibleItems.find((entry) => entry.id === itemId);
      if (!item) return;
      const confirmed = await ask(purgeConfirmMessage([item]), {
        title: "完全に削除",
        kind: "warning",
        okLabel: "完全に削除",
        cancelLabel: "キャンセル",
      });
      if (!confirmed) return;
      try {
        await purgeItems(libraryPath, [itemId]);
        session.setError(null);
        browser.clearSelection();
        await invalidate();
      } catch (e) {
        session.setError(`完全に削除できませんでした: ${e}`);
      }
    },
    [libraryPath, browser.visibleItems, browser.clearSelection, invalidate, session.setError],
  );

  const disabled = session.library === null;

  return (
    <FoldersProvider value={folders}>
      <SmartFoldersProvider value={smartFolders}>
        <TagsProvider value={tags}>
          <div className="layout">
            <aside className="sidebar">
              <div className="library-header">
                <div className="library-name" title={session.library?.path}>
                  {session.library?.name ?? "ライブラリ未選択"}
                </div>
                <div className="library-actions">
                  <button type="button" onClick={() => void session.handleCreate()}>
                    新規作成
                  </button>
                  <button type="button" onClick={() => void session.handleOpen()}>
                    開く
                  </button>
                </div>
              </div>
              <SidebarSections
                libraryPath={libraryPath}
                view={browser.view}
                onViewChange={browser.setView}
                disabled={disabled}
              />
            </aside>
            <main
              ref={contentRef}
              className={assetImport.dragOver ? "content drag-over" : "content"}
            >
              <header className="toolbar">
                <input
                  className="search"
                  type="search"
                  placeholder="名前・タグ・注釈で検索"
                  value={browser.query}
                  onChange={(e) => browser.setQuery(e.target.value)}
                  disabled={disabled}
                />
                <AdvancedSearch
                  criteria={browser.searchCriteria}
                  onChange={browser.setSearchCriteria}
                  onClear={browser.clearAdvancedSearch}
                  folders={folders.folders}
                  libraryTags={tags.libraryTags?.tags ?? []}
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => quickLook.open()}
                  disabled={disabled || !quickLook.canOpen}
                  title="選択中のアイテムを拡大プレビュー（Space）"
                >
                  クイックルック
                </button>
                <button
                  type="button"
                  onClick={() => void assetImport.pickAndImport()}
                  disabled={disabled || assetImport.importing}
                >
                  {assetImport.importing ? "取り込み中…" : "ファイル取り込み"}
                </button>
                <button
                  type="button"
                  onClick={() => void assetImport.pickFoldersAndImport()}
                  disabled={disabled || assetImport.importing}
                >
                  フォルダ取り込み
                </button>
              </header>
              {session.error && (
                <div className="error" role="alert">
                  {session.error}
                </div>
              )}
              <ImportReportBanner
                report={assetImport.report}
                error={assetImport.error}
                onDismiss={assetImport.dismiss}
              />
              {libraryPath ? (
                items.length === 0 ? (
                  <section className="grid-placeholder">ファイルをドロップして取り込み</section>
                ) : browser.visibleItems.length === 0 ? (
                  <section className="grid-placeholder">該当するアイテムがありません</section>
                ) : (
                  <ItemGrid
                    libraryPath={libraryPath}
                    items={browser.visibleItems}
                    selection={browser.selection}
                    onSelect={browser.handleSelect}
                    onSelectAll={browser.handleSelectAll}
                    onClearSelection={browser.clearSelection}
                    onDelete={trash.onDelete}
                    onQuickLook={quickLook.openAt}
                    isTrashView={isTrashView}
                    onContextTrash={isTrashView ? undefined : () => void trash.handleTrash()}
                    onContextRestore={
                      isTrashView ? (id) => void handleContextRestore(id) : undefined
                    }
                    onContextPurge={isTrashView ? (id) => void handleContextPurge(id) : undefined}
                    onContextEditTags={isTrashView ? undefined : handleContextEditTags}
                    onContextRevealInExplorer={(id) => void handleContextRevealInExplorer(id)}
                  />
                )
              ) : (
                <section className="grid-placeholder">
                  <div className="empty-library">
                    <p>ライブラリが開かれていません</p>
                    <div className="library-actions">
                      <button type="button" onClick={() => void session.handleCreate()}>
                        新規ライブラリを作成
                      </button>
                      <button type="button" onClick={() => void session.handleOpen()}>
                        ライブラリを開く
                      </button>
                    </div>
                    {session.recent.length > 0 && (
                      <div className="recent-libraries">
                        <p>最近使ったライブラリ</p>
                        <ul>
                          {session.recent.map((path) => (
                            <li key={path}>
                              <button
                                type="button"
                                title={path}
                                onClick={() => void session.openPath(path)}
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
              )}
            </main>
            <aside className="inspector">
              {browser.selectedCount > 1 ? (
                <div className="inspector-body">
                  <p className="inspector-muted">{browser.selectedCount} 件を選択中</p>
                  <FolderAssignControl
                    key={[...browser.selection.ids].sort().join("\n")}
                    folders={folders.folders}
                    onAssign={(folderId) =>
                      folders.assignToFolder([...browser.selection.ids], folderId)
                    }
                    onUnassign={(folderId) =>
                      folders.unassignFromFolder([...browser.selection.ids], folderId)
                    }
                  />
                </div>
              ) : (
                <>
                  <Inspector
                    item={browser.selected}
                    folders={folders.folders}
                    libraryTagNames={tags.libraryTags?.tags ?? []}
                    onSave={saveItem}
                    onAssignFolder={(id, folderId) => folders.assignToFolder([id], folderId)}
                    onUnassignFolder={(id, folderId) => folders.unassignFromFolder([id], folderId)}
                    onAddTags={tags.addItemTags}
                    onRemoveTags={tags.removeItemTags}
                  />
                  <TrashActions
                    key={browser.selected?.id}
                    item={browser.selected}
                    onTrash={trash.trashSelected}
                    onRestore={trash.restoreSelected}
                    onPurge={trash.purgeSelected}
                  />
                </>
              )}
              <AppInfo />
            </aside>
            {quickLook.isOpen && quickLook.target && libraryPath && (
              <QuickLook
                key={quickLook.target.item.id}
                libraryPath={libraryPath}
                target={quickLook.target}
                scaleMode={quickLook.scaleMode}
                onScaleModeChange={quickLook.setScaleMode}
                onClose={quickLook.close}
                onPrev={quickLook.goPrev}
                onNext={quickLook.goNext}
              />
            )}
          </div>
        </TagsProvider>
      </SmartFoldersProvider>
    </FoldersProvider>
  );
}

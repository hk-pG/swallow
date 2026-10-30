import { useRef } from "react";
import { InspectorPane } from "./components/InspectorPane";
import { LibraryToolbar } from "./components/LibraryToolbar";
import { MainItemView } from "./components/MainItemView";
import { QuickLook } from "./components/QuickLook";
import { ImportReportBanner } from "./ImportReportBanner";
import { itemThumbContentStyle } from "./lib/itemThumbContentStyle";
import { useAppearanceSettings } from "./lib/useAppearanceSettings";
import { useAssetImport } from "./lib/useAssetImport";
import { useFolders } from "./lib/useFolders";
import { useItemBrowser } from "./lib/useItemBrowser";
import { useItemList } from "./lib/useItemList";
import { useItemViewState } from "./lib/useItemViewState";
import { useLibrarySession } from "./lib/useLibrarySession";
import { useQuickLook } from "./lib/useQuickLook";
import { useSmartFolders } from "./lib/useSmartFolders";
import { useTags } from "./lib/useTags";
import { useTrashActions } from "./lib/useTrashActions";
import { FoldersProvider } from "./sidebar/FoldersContext";
import { SmartFoldersProvider } from "./sidebar/SmartFoldersContext";
import { SidebarSections } from "./sidebar/sections";
import { TagsProvider } from "./sidebar/TagsContext";

export function App() {
  const session = useLibrarySession();
  const appearance = useAppearanceSettings();
  const { libraryPath } = session;
  const contentStyle = itemThumbContentStyle(appearance.itemView.thumbnailSizeIndex);
  const { items, invalidate, saveItem } = useItemList(libraryPath);

  const viewState = useItemViewState();
  const folders = useFolders({
    libraryPath,
    invalidateItems: invalidate,
    setView: viewState.setView,
  });
  const tags = useTags({
    libraryPath,
    invalidateItems: invalidate,
    setView: viewState.setView,
  });
  const smartFolders = useSmartFolders({ libraryPath, setView: viewState.setView });
  const browser = useItemBrowser(items, folders.folders, smartFolders.smartFolders, viewState);

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
    visibleItems: browser.visibleItems,
    selection: browser.selection,
    selected: browser.selected,
    setSelection: browser.setSelection,
    clearSelection: browser.clearSelection,
    onSelectItem: browser.handleSelect,
    invalidate,
    setError: session.setError,
  });

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
              style={contentStyle}
            >
              <LibraryToolbar
                disabled={disabled}
                query={browser.query}
                onQueryChange={browser.setQuery}
                searchCriteria={browser.searchCriteria}
                onSearchCriteriaChange={browser.setSearchCriteria}
                onClearAdvancedSearch={browser.clearAdvancedSearch}
                folders={folders.folders}
                libraryTagNames={tags.libraryTags?.tags ?? []}
                appearance={appearance}
                quickLookDisabled={!quickLook.canOpen}
                onQuickLook={() => quickLook.open()}
                importing={assetImport.importing}
                onPickAndImport={() => void assetImport.pickAndImport()}
                onPickFoldersAndImport={() => void assetImport.pickFoldersAndImport()}
              />
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
              <MainItemView
                libraryPath={libraryPath}
                itemCount={items.length}
                visibleItems={browser.visibleItems}
                itemViewMode={appearance.itemView.itemViewMode}
                selection={browser.selection}
                recentLibraries={session.recent}
                onSelect={browser.handleSelect}
                onSelectAll={browser.handleSelectAll}
                onClearSelection={browser.clearSelection}
                onDelete={trash.onDelete}
                onQuickLook={quickLook.openAt}
                onCreateLibrary={() => void session.handleCreate()}
                onOpenLibrary={() => void session.handleOpen()}
                onOpenRecent={(path) => void session.openPath(path)}
                {...trash.contextHandlers}
              />
            </main>
            <InspectorPane
              selectedCount={browser.selectedCount}
              selection={browser.selection}
              selected={browser.selected}
              folders={folders.folders}
              libraryTagNames={tags.libraryTags?.tags ?? []}
              onSave={saveItem}
              onAssignFolder={(ids, folderId) => folders.assignToFolder(ids, folderId)}
              onUnassignFolder={(ids, folderId) => folders.unassignFromFolder(ids, folderId)}
              onAddTags={tags.addItemTags}
              onRemoveTags={tags.removeItemTags}
              trash={trash}
            />
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

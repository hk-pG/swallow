import { ImportReportBanner } from "../features/import/components/ImportReportBanner";
import { InspectorPane } from "../features/inspector/components/InspectorPane";
import { LibraryToolbar } from "../features/items/components/LibraryToolbar";
import { MainItemView } from "../features/items/components/MainItemView";
import { QuickLook } from "../features/quick-look/components/QuickLook";
import { SidebarSections } from "./sidebarRegistry";
import type { AppSession } from "./useAppSession";

export function AppLayout({ session }: { session: AppSession }) {
  const {
    appearance,
    libraryPath,
    contentStyle,
    items,
    saveItem,
    folders,
    tags,
    browser,
    contentRef,
    assetImport,
    quickLook,
    trash,
    disabled,
  } = session;
  const { session: librarySession } = session;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="library-header">
          <div className="library-name" title={librarySession.library?.path}>
            {librarySession.library?.name ?? "ライブラリ未選択"}
          </div>
          <div className="library-actions">
            <button
              type="button"
              className="push-button compact"
              onClick={() => void librarySession.handleCreate()}
            >
              新規作成
            </button>
            <button
              type="button"
              className="push-button compact"
              onClick={() => void librarySession.handleOpen()}
            >
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
        {librarySession.error && (
          <div className="error" role="alert">
            {librarySession.error}
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
          recentLibraries={librarySession.recent}
          onSelect={browser.handleSelect}
          onSelectAll={browser.handleSelectAll}
          onClearSelection={browser.clearSelection}
          onDelete={trash.onDelete}
          onQuickLook={quickLook.openAt}
          onCreateLibrary={() => void librarySession.handleCreate()}
          onOpenLibrary={() => void librarySession.handleOpen()}
          onOpenRecent={(path) => void librarySession.openPath(path)}
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
  );
}

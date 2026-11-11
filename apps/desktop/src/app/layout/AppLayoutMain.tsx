import { ImportReportBanner } from "../../features/import";
import { LibraryToolbar, MainItemView } from "../../features/items";
import type { AppSessionBrowser } from "../session/useAppSessionBrowser";
import type { AppSessionLibrary } from "../session/useAppSessionLibrary";
import type { AppSessionWorkspace } from "../session/useAppSessionWorkspace";

export function AppLayoutMain({
  library,
  browser,
  workspace,
}: {
  library: AppSessionLibrary;
  browser: AppSessionBrowser;
  workspace: AppSessionWorkspace;
}) {
  const {
    session: librarySession,
    libraryPath,
    contentStyle,
    items,
    appearance,
    disabled,
  } = library;
  const { folders, tags, browser: itemBrowser } = browser;
  const { contentRef, assetImport, quickLook, trash } = workspace;

  return (
    <main
      ref={contentRef}
      className={assetImport.dragOver ? "content drag-over" : "content"}
      style={contentStyle}
    >
      <LibraryToolbar
        disabled={disabled}
        query={itemBrowser.query}
        onQueryChange={itemBrowser.setQuery}
        searchCriteria={itemBrowser.searchCriteria}
        onSearchCriteriaChange={itemBrowser.setSearchCriteria}
        onClearAdvancedSearch={itemBrowser.clearAdvancedSearch}
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
        visibleItems={itemBrowser.visibleItems}
        itemViewMode={appearance.itemView.itemViewMode}
        selection={itemBrowser.selection}
        recentLibraries={librarySession.recent}
        onSelect={itemBrowser.handleSelect}
        onSelectAll={itemBrowser.handleSelectAll}
        onClearSelection={itemBrowser.clearSelection}
        onDelete={trash.onDelete}
        onQuickLook={quickLook.openAt}
        onCreateLibrary={() => void librarySession.handleCreate()}
        onOpenLibrary={() => void librarySession.handleOpen()}
        onOpenRecent={(path) => void librarySession.openPath(path)}
        {...trash.contextHandlers}
      />
    </main>
  );
}

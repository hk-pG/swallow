import { useRef } from "react";
import { AppInfo } from "./components/AppInfo";
import { Inspector } from "./components/Inspector";
import { ItemGrid } from "./components/ItemGrid";
import { TrashActions } from "./components/TrashActions";
import { ImportReportBanner } from "./ImportReportBanner";
import { useAssetImport } from "./lib/useAssetImport";
import { useItemBrowser } from "./lib/useItemBrowser";
import { useItemList } from "./lib/useItemList";
import { useLibrarySession } from "./lib/useLibrarySession";
import { useTrashActions } from "./lib/useTrashActions";
import { SidebarSections } from "./sidebar/sections";

export function App() {
  const session = useLibrarySession();
  const { libraryPath } = session;
  const { items, invalidate, saveItem } = useItemList(libraryPath);
  const browser = useItemBrowser(items);
  const contentRef = useRef<HTMLElement>(null);
  const assetImport = useAssetImport(libraryPath, contentRef, invalidate);
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

  const disabled = session.library === null;

  return (
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
      <main ref={contentRef} className={assetImport.dragOver ? "content drag-over" : "content"}>
        <header className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="名前・タグ・注釈で検索"
            value={browser.query}
            onChange={(e) => browser.setQuery(e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => void assetImport.pickAndImport()}
            disabled={disabled || assetImport.importing}
          >
            {assetImport.importing ? "取り込み中…" : "取り込み"}
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
          <p className="inspector-empty">{browser.selectedCount} 件を選択中</p>
        ) : (
          <>
            <Inspector item={browser.selected} onSave={saveItem} />
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
    </div>
  );
}

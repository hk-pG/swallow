import type { AppInfo, ItemId, ItemMetadata, LibraryInfo } from "@swallow/shared";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { ItemGrid } from "./components/ItemGrid";
import { ImportReportBanner } from "./ImportReportBanner";
import {
  createLibrary,
  getAppInfo,
  getRecentLibraries,
  listItems,
  openLibrary,
  restoreLibrary,
} from "./lib/commands";
import { useAssetImport } from "./lib/useAssetImport";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<ItemId | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const libraryPath = library?.path ?? null;
  const assetImport = useAssetImport(libraryPath, contentRef);

  const refreshRecent = useCallback(() => {
    getRecentLibraries().then(setRecent).catch(console.error);
  }, []);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(console.error);
    restoreLibrary()
      .then(setLibrary)
      .catch((e) => setError(String(e)))
      .finally(refreshRecent);
  }, [refreshRecent]);

  const run = async (action: (path: string) => Promise<LibraryInfo>, path: string) => {
    try {
      setLibrary(await action(path));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      refreshRecent();
    }
  };

  const pickDirectory = async (title: string) => {
    const path = await open({ directory: true, title });
    return typeof path === "string" ? path : null;
  };

  const handleCreate = async () => {
    const path = await pickDirectory("新規ライブラリにする空のフォルダを選択");
    if (path) await run(createLibrary, path);
  };

  const handleOpen = async () => {
    const path = await pickDirectory("ライブラリを開く");
    if (path) await run(openLibrary, path);
  };

  const disabled = library === null;

  // Re-reads the library after each import so new items appear in the grid.
  const importReport = assetImport.report;
  useEffect(() => {
    void importReport;
    if (!libraryPath) {
      setItems([]);
      return;
    }
    let cancelled = false;
    listItems(libraryPath)
      .then((all) => {
        if (!cancelled) setItems(all.filter((item) => !item.isDeleted));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [libraryPath, importReport]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="library-header">
          <div className="library-name" title={library?.path}>
            {library?.name ?? "ライブラリ未選択"}
          </div>
          <div className="library-actions">
            <button type="button" onClick={handleCreate}>
              新規作成
            </button>
            <button type="button" onClick={handleOpen}>
              開く
            </button>
          </div>
        </div>
        <nav>
          <button type="button" className="nav-item" disabled={disabled}>
            全アイテム
          </button>
          <button type="button" className="nav-item" disabled={disabled}>
            未分類
          </button>
          <button type="button" className="nav-item" disabled={disabled}>
            ゴミ箱
          </button>
        </nav>
      </aside>
      <main ref={contentRef} className={assetImport.dragOver ? "content drag-over" : "content"}>
        <header className="toolbar">
          <input className="search" type="search" placeholder="検索" disabled={disabled} />
          <button
            type="button"
            onClick={() => void assetImport.pickAndImport()}
            disabled={disabled || assetImport.importing}
          >
            {assetImport.importing ? "取り込み中…" : "取り込み"}
          </button>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <ImportReportBanner
          report={assetImport.report}
          error={assetImport.error}
          onDismiss={assetImport.dismiss}
        />
        {libraryPath ? (
          items.length > 0 ? (
            <ItemGrid
              libraryPath={libraryPath}
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <section className="grid-placeholder">ファイルをドロップして取り込み</section>
          )
        ) : (
          <section className="grid-placeholder">
            <div className="empty-library">
              <p>ライブラリが開かれていません</p>
              <div className="library-actions">
                <button type="button" onClick={handleCreate}>
                  新規ライブラリを作成
                </button>
                <button type="button" onClick={handleOpen}>
                  ライブラリを開く
                </button>
              </div>
              {recent.length > 0 && (
                <div className="recent-libraries">
                  <p>最近使ったライブラリ</p>
                  <ul>
                    {recent.map((path) => (
                      <li key={path}>
                        <button type="button" title={path} onClick={() => run(openLibrary, path)}>
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
        {selected && (
          <p className="inspector-name">
            {selected.name}.{selected.ext}
          </p>
        )}
        {info && (
          <p className="app-info">
            {info.name} v{info.version}
          </p>
        )}
      </aside>
    </div>
  );
}

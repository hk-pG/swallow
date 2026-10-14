import {
  type AppInfo,
  type Folder,
  filterItems,
  type ItemId,
  type ItemMetadata,
  type ItemMetadataPatch,
  type ItemView,
  type LibraryInfo,
} from "@swallow/shared";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inspector } from "./components/Inspector";
import { ItemGrid } from "./components/ItemGrid";
import { SmartViewNav } from "./components/SmartViewNav";
import { ImportReportBanner } from "./ImportReportBanner";
import {
  createLibrary,
  getAppInfo,
  getRecentLibraries,
  listItems,
  openLibrary,
  restoreLibrary,
  trashItems,
  updateItem,
} from "./lib/commands";
import {
  EMPTY_SELECTION,
  nextAfterRemoval,
  retainVisible,
  type Selection,
  type SelectModifiers,
  select,
  selectAll,
} from "./lib/selection";
import { useAssetImport } from "./lib/useAssetImport";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemMetadata[]>([]);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [view, setView] = useState<ItemView>({ kind: "all" });
  const [query, setQuery] = useState("");
  // TODO(#7): load from the library's folder tree.
  const [folders] = useState<Folder[]>([]);
  const contentRef = useRef<HTMLElement>(null);
  const libraryPath = library?.path ?? null;

  // Only the latest request may update `items`, so a slow reload for a previous library is dropped.
  const reloadSeq = useRef(0);
  const reloadItems = useCallback(async () => {
    const seq = ++reloadSeq.current;
    if (!libraryPath) {
      setItems([]);
      return;
    }
    try {
      const all = await listItems(libraryPath);
      if (seq === reloadSeq.current) setItems(all);
    } catch (e) {
      console.error(e);
    }
  }, [libraryPath]);

  useEffect(() => {
    void reloadItems();
  }, [reloadItems]);

  const assetImport = useAssetImport(libraryPath, contentRef, reloadItems);

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

  const visibleItems = useMemo(() => filterItems(items, view, query), [items, view, query]);
  const visibleIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);

  useEffect(() => setSelection((current) => retainVisible(current, visibleIds)), [visibleIds]);

  const handleSelect = useCallback(
    (id: ItemId, modifiers: SelectModifiers) =>
      setSelection((current) => select(current, visibleIds, id, modifiers)),
    [visibleIds],
  );
  const handleSelectAll = useCallback(
    () => setSelection((current) => selectAll(current, visibleIds)),
    [visibleIds],
  );
  const clearSelection = useCallback(() => setSelection(EMPTY_SELECTION), []);

  // Read through a ref so `handleTrash` stays stable and grid cells don't re-render on every selection change.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const handleTrash = useCallback(async () => {
    const selection = selectionRef.current;
    if (!libraryPath || selection.ids.size === 0) return;
    const ids = [...selection.ids];
    try {
      await trashItems(libraryPath, ids);
      setError(null);
    } catch (e) {
      setError(`ゴミ箱に移動できませんでした: ${e}`);
      return;
    }
    const next = nextAfterRemoval(visibleIds, selection.ids, selection.focus);
    setSelection(next === null ? EMPTY_SELECTION : select(EMPTY_SELECTION, visibleIds, next));
    await reloadItems();
  }, [libraryPath, visibleIds, reloadItems]);

  const selectedCount = selection.ids.size;
  const [selectedId] = selection.ids;
  const selected =
    selectedCount === 1 ? (items.find((item) => item.id === selectedId) ?? null) : null;

  const saveItem = async (id: ItemId, patch: ItemMetadataPatch) => {
    if (!libraryPath) throw new Error("ライブラリが開かれていません");
    const updated = await updateItem(libraryPath, id, patch);
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

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
        <SmartViewNav view={view} onChange={setView} disabled={disabled} />
      </aside>
      <main ref={contentRef} className={assetImport.dragOver ? "content drag-over" : "content"}>
        <header className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="名前・タグ・注釈で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
          items.length === 0 ? (
            <section className="grid-placeholder">ファイルをドロップして取り込み</section>
          ) : visibleItems.length === 0 ? (
            <section className="grid-placeholder">該当するアイテムがありません</section>
          ) : (
            <ItemGrid
              libraryPath={libraryPath}
              items={visibleItems}
              selection={selection}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onClearSelection={clearSelection}
              onDelete={view.kind === "trash" ? undefined : handleTrash}
            />
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
        {selectedCount > 1 ? (
          <p className="inspector-empty">{selectedCount} 件を選択中</p>
        ) : (
          <Inspector item={selected} folders={folders} onSave={saveItem} />
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

import type { AppInfo, ItemId, ItemMetadata } from "@swallow/shared";
import { useEffect, useState } from "react";
import { ItemGrid } from "./components/ItemGrid";
import { getAppInfo, listItems } from "./lib/commands";

/** Until opening libraries is implemented, a library can be pointed at via `.env.local`. */
const DEV_LIBRARY_PATH: string | null = import.meta.env.VITE_DEV_LIBRARY_PATH || null;

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [libraryPath] = useState<string | null>(DEV_LIBRARY_PATH);
  const [items, setItems] = useState<ItemMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<ItemId | null>(null);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(console.error);
  }, []);

  useEffect(() => {
    setItems([]);
    setSelectedId(null);
    if (!libraryPath) return;
    let cancelled = false;
    listItems(libraryPath)
      .then((all) => {
        if (!cancelled) setItems(all.filter((item) => !item.isDeleted));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [libraryPath]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="layout">
      <aside className="sidebar">
        <nav>
          <div className="nav-item">全アイテム</div>
          <div className="nav-item">未分類</div>
          <div className="nav-item">ゴミ箱</div>
        </nav>
      </aside>
      <main className="content">
        <header className="toolbar">
          <input className="search" type="search" placeholder="検索" disabled />
        </header>
        {libraryPath ? (
          <ItemGrid
            libraryPath={libraryPath}
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <section className="grid-placeholder">ライブラリが開かれていません</section>
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

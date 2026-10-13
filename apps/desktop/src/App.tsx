import type { AppInfo, Folder, ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import { useEffect, useState } from "react";
import { Inspector } from "./components/Inspector";
import { getAppInfo, updateItem } from "./lib/commands";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [libraryPath] = useState<string | null>(null);
  const [folders] = useState<Folder[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemMetadata | null>(null);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(console.error);
  }, []);

  const saveItem = async (id: ItemId, patch: ItemMetadataPatch) => {
    if (!libraryPath) throw new Error("ライブラリが開かれていません");
    const updated = await updateItem(libraryPath, id, patch);
    setSelectedItem((current) => (current?.id === updated.id ? updated : current));
  };

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
        <section className="grid-placeholder">ライブラリが開かれていません</section>
      </main>
      <aside className="inspector">
        <Inspector item={selectedItem} folders={folders} onSave={saveItem} />
        {info && (
          <p className="app-info">
            {info.name} v{info.version}
          </p>
        )}
      </aside>
    </div>
  );
}

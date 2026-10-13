import { type AppInfo, filterItems, type ItemMetadata, type ItemView } from "@swallow/shared";
import { useEffect, useMemo, useState } from "react";
import { SmartViewNav } from "./components/SmartViewNav";
import { getAppInfo } from "./lib/commands";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [items] = useState<ItemMetadata[]>([]);
  const [view, setView] = useState<ItemView>({ kind: "all" });
  const [query, setQuery] = useState("");

  const visibleItems = useMemo(() => filterItems(items, view, query), [items, view, query]);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(console.error);
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <SmartViewNav view={view} onChange={setView} />
      </aside>
      <main className="content">
        <header className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="名前・タグ・注釈で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>
        {items.length === 0 ? (
          <section className="grid-placeholder">ライブラリが開かれていません</section>
        ) : visibleItems.length === 0 ? (
          <section className="grid-placeholder">該当するアイテムがありません</section>
        ) : (
          <ul className="item-list">
            {visibleItems.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        )}
      </main>
      <aside className="inspector">
        {info && (
          <p className="app-info">
            {info.name} v{info.version}
          </p>
        )}
      </aside>
    </div>
  );
}

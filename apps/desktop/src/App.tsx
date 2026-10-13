import type { AppInfo } from "@swallow/shared";
import { useEffect, useState } from "react";
import { getAppInfo } from "./lib/commands";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    getAppInfo().then(setInfo).catch(console.error);
  }, []);

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
        {info && (
          <p className="app-info">
            {info.name} v{info.version}
          </p>
        )}
      </aside>
    </div>
  );
}

import type { AppInfo } from "@swallow/shared";
import { useEffect, useRef, useState } from "react";
import { ImportReportBanner } from "./ImportReportBanner";
import { getAppInfo } from "./lib/commands";
import { useAssetImport } from "./lib/useAssetImport";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  // TODO(#3): set from the opened library.
  const [libraryPath] = useState<string | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const assetImport = useAssetImport(libraryPath, contentRef);

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
      <main ref={contentRef} className={assetImport.dragOver ? "content drag-over" : "content"}>
        <header className="toolbar">
          <input className="search" type="search" placeholder="検索" disabled />
          <button
            type="button"
            onClick={() => void assetImport.pickAndImport()}
            disabled={!libraryPath || assetImport.importing}
          >
            {assetImport.importing ? "取り込み中…" : "取り込み"}
          </button>
        </header>
        <ImportReportBanner
          report={assetImport.report}
          error={assetImport.error}
          onDismiss={assetImport.dismiss}
        />
        <section className="grid-placeholder">
          {libraryPath ? "ファイルをドロップして取り込み" : "ライブラリが開かれていません"}
        </section>
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

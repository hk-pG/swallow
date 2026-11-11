import type { AppSessionBrowser } from "../session/useAppSessionBrowser";
import type { AppSessionLibrary } from "../session/useAppSessionLibrary";
import { SidebarSections } from "../sidebarRegistry";

export function AppLayoutSidebar({
  library,
  browser,
}: {
  library: AppSessionLibrary;
  browser: AppSessionBrowser;
}) {
  const { session: librarySession, libraryPath, disabled } = library;
  const { browser: itemBrowser } = browser;

  return (
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
        view={itemBrowser.view}
        onViewChange={itemBrowser.setView}
        disabled={disabled}
      />
    </aside>
  );
}

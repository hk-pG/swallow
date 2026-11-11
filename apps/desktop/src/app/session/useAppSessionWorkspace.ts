import { useRef } from "react";
import { useAssetImport } from "../../features/import";
import { useQuickLook } from "../../features/quick-look";
import { useTrashActions } from "../../features/trash";
import type { AppSessionBrowser } from "./useAppSessionBrowser";
import type { AppSessionLibrary } from "./useAppSessionLibrary";

export function useAppSessionWorkspace(library: AppSessionLibrary, browser: AppSessionBrowser) {
  const contentRef = useRef<HTMLElement>(null);
  const refreshAfterImport = async () => {
    await library.invalidate();
    await browser.folders.reload();
  };
  const assetImport = useAssetImport(library.libraryPath, contentRef, refreshAfterImport);
  const quickLook = useQuickLook(
    browser.browser.selection,
    browser.browser.visibleIds,
    browser.browser.visibleItems,
  );
  const trash = useTrashActions({
    libraryPath: library.libraryPath,
    view: browser.browser.view,
    visibleIds: browser.browser.visibleIds,
    visibleItems: browser.browser.visibleItems,
    selection: browser.browser.selection,
    selected: browser.browser.selected,
    setSelection: browser.browser.setSelection,
    clearSelection: browser.browser.clearSelection,
    onSelectItem: browser.browser.handleSelect,
    invalidate: library.invalidate,
    setError: library.session.setError,
  });

  return {
    contentRef,
    assetImport,
    quickLook,
    trash,
  };
}

export type AppSessionWorkspace = ReturnType<typeof useAppSessionWorkspace>;

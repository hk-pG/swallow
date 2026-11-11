import { useRef } from "react";
import { useFolders } from "../features/folders";
import { useAssetImport } from "../features/import";
import { itemThumbContentStyle, useItemList } from "../features/items";
import { useLibrarySession } from "../features/library";
import { useQuickLook } from "../features/quick-look";
import { useAppearanceSettings } from "../features/settings";
import { useSmartFolders } from "../features/smart-folders";
import { useItemBrowser, useItemViewState } from "../features/smart-views";
import { useTags } from "../features/tags";
import { useTrashActions } from "../features/trash";

export function useAppSession() {
  const session = useLibrarySession();
  const appearance = useAppearanceSettings();
  const { libraryPath } = session;
  const contentStyle = itemThumbContentStyle(appearance.itemView.thumbnailSizeIndex);
  const { items, invalidate, saveItem } = useItemList(libraryPath);

  const viewState = useItemViewState();
  const folders = useFolders({
    libraryPath,
    invalidateItems: invalidate,
    setView: viewState.setView,
  });
  const tags = useTags({
    libraryPath,
    invalidateItems: invalidate,
    setView: viewState.setView,
  });
  const smartFolders = useSmartFolders({ libraryPath, setView: viewState.setView });
  const browser = useItemBrowser(items, folders.folders, smartFolders.smartFolders, viewState);

  const contentRef = useRef<HTMLElement>(null);
  const refreshAfterImport = async () => {
    await invalidate();
    await folders.reload();
  };
  const assetImport = useAssetImport(libraryPath, contentRef, refreshAfterImport);
  const quickLook = useQuickLook(browser.selection, browser.visibleIds, browser.visibleItems);
  const trash = useTrashActions({
    libraryPath,
    view: browser.view,
    visibleIds: browser.visibleIds,
    visibleItems: browser.visibleItems,
    selection: browser.selection,
    selected: browser.selected,
    setSelection: browser.setSelection,
    clearSelection: browser.clearSelection,
    onSelectItem: browser.handleSelect,
    invalidate,
    setError: session.setError,
  });

  const disabled = session.library === null;

  return {
    session,
    appearance,
    libraryPath,
    contentStyle,
    items,
    saveItem,
    folders,
    tags,
    smartFolders,
    browser,
    contentRef,
    assetImport,
    quickLook,
    trash,
    disabled,
  };
}

export type AppSession = ReturnType<typeof useAppSession>;

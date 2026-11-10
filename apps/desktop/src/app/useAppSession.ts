import { useRef } from "react";
import { useFolders } from "../features/folders/hooks/useFolders";
import { useAssetImport } from "../features/import/hooks/useAssetImport";
import { useItemList } from "../features/items/hooks/useItemList";
import { itemThumbContentStyle } from "../features/items/lib/itemThumbContentStyle";
import { useLibrarySession } from "../features/library/hooks/useLibrarySession";
import { useQuickLook } from "../features/quick-look/hooks/useQuickLook";
import { useAppearanceSettings } from "../features/settings/hooks/useAppearanceSettings";
import { useSmartFolders } from "../features/smart-folders/hooks/useSmartFolders";
import { useItemBrowser } from "../features/smart-views/hooks/useItemBrowser";
import { useItemViewState } from "../features/smart-views/hooks/useItemViewState";
import { useTags } from "../features/tags/hooks/useTags";
import { useTrashActions } from "../features/trash/hooks/useTrashActions";

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

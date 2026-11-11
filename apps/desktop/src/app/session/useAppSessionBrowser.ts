import { useFolders } from "../../features/folders";
import { useSmartFolders } from "../../features/smart-folders";
import { useItemBrowser, useItemViewState } from "../../features/smart-views";
import { useTags } from "../../features/tags";
import type { AppSessionLibrary } from "./useAppSessionLibrary";

export function useAppSessionBrowser(library: AppSessionLibrary) {
  const viewState = useItemViewState();
  const folders = useFolders({
    libraryPath: library.libraryPath,
    invalidateItems: library.invalidate,
    setView: viewState.setView,
  });
  const tags = useTags({
    libraryPath: library.libraryPath,
    invalidateItems: library.invalidate,
    setView: viewState.setView,
  });
  const smartFolders = useSmartFolders({
    libraryPath: library.libraryPath,
    setView: viewState.setView,
  });
  const browser = useItemBrowser(
    library.items,
    folders.folders,
    smartFolders.smartFolders,
    viewState,
  );

  return {
    viewState,
    folders,
    tags,
    smartFolders,
    browser,
  };
}

export type AppSessionBrowser = ReturnType<typeof useAppSessionBrowser>;

import { itemThumbContentStyle, useItemList } from "../../features/items";
import { useLibrarySession } from "../../features/library";
import { useAppearanceSettings } from "../../features/settings";

export function useAppSessionLibrary() {
  const session = useLibrarySession();
  const appearance = useAppearanceSettings();
  const { libraryPath } = session;
  const contentStyle = itemThumbContentStyle(appearance.itemView.thumbnailSizeIndex);
  const { items, invalidate, saveItem } = useItemList(libraryPath);
  const disabled = session.library === null;

  return {
    session,
    appearance,
    libraryPath,
    contentStyle,
    items,
    invalidate,
    saveItem,
    disabled,
  };
}

export type AppSessionLibrary = ReturnType<typeof useAppSessionLibrary>;

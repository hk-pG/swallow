import type { Folder, FolderId, ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import { AppInfo } from "../../library";
import { type AppearanceSettingsState, AppearanceSwitcher } from "../../settings";
import { TrashActions, type TrashActionsApi } from "../../trash";
import { Inspector } from "./Inspector";
import { MultiItemInspector } from "./MultiItemInspector";

interface InspectorPaneProps {
  appearance: AppearanceSettingsState;
  selectedCount: number;
  selectedItems: readonly ItemMetadata[];
  selected: ItemMetadata | null;
  folders: readonly Folder[];
  libraryTagNames: string[];
  onSave: (id: ItemId, patch: ItemMetadataPatch) => Promise<void>;
  onSaveItems: (ids: ItemId[], patch: ItemMetadataPatch) => Promise<void>;
  onAssignFolder: (ids: ItemId[], folderId: FolderId) => Promise<void>;
  onUnassignFolder: (ids: ItemId[], folderId: FolderId) => Promise<void>;
  onAddTags: (itemId: ItemId, tags: string[]) => Promise<void>;
  onRemoveTags: (itemId: ItemId, tags: string[]) => Promise<void>;
  onAddTagsToItems: (itemIds: ItemId[], tags: string[]) => Promise<void>;
  onRemoveTagsFromItems: (itemIds: ItemId[], tags: string[]) => Promise<void>;
  trash: Pick<TrashActionsApi, "trashSelected" | "restoreSelected" | "purgeSelected">;
}

export function InspectorPane({
  appearance,
  selectedCount,
  selectedItems,
  selected,
  folders,
  libraryTagNames,
  onSave,
  onSaveItems,
  onAssignFolder,
  onUnassignFolder,
  onAddTags,
  onRemoveTags,
  onAddTagsToItems,
  onRemoveTagsFromItems,
  trash,
}: InspectorPaneProps) {
  const folderList = [...folders];

  return (
    <aside className="inspector">
      {selectedCount > 1 ? (
        <MultiItemInspector
          selectedCount={selectedCount}
          selectedItems={selectedItems}
          folders={folderList}
          libraryTagNames={libraryTagNames}
          onSaveItems={onSaveItems}
          onAssignFolder={onAssignFolder}
          onUnassignFolder={onUnassignFolder}
          onAddTags={onAddTagsToItems}
          onRemoveTags={onRemoveTagsFromItems}
        />
      ) : (
        <>
          <Inspector
            item={selected}
            folders={folderList}
            libraryTagNames={libraryTagNames}
            onSave={onSave}
            onAssignFolder={(id, folderId) => onAssignFolder([id], folderId)}
            onUnassignFolder={(id, folderId) => onUnassignFolder([id], folderId)}
            onAddTags={onAddTags}
            onRemoveTags={onRemoveTags}
          />
          <TrashActions
            key={selected?.id}
            item={selected}
            onTrash={trash.trashSelected}
            onRestore={trash.restoreSelected}
            onPurge={trash.purgeSelected}
          />
        </>
      )}
      <section className="inspector-section" aria-label="表示設定">
        <h3>表示</h3>
        <AppearanceSwitcher
          themeId={appearance.themeId}
          colorScheme={appearance.colorScheme}
          onThemeIdChange={appearance.setThemeId}
          onColorSchemeChange={appearance.setColorScheme}
        />
      </section>
      <AppInfo />
    </aside>
  );
}

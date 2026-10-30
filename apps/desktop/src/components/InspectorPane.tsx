import type { Folder, FolderId, ItemId, ItemMetadata, ItemMetadataPatch } from "@swallow/shared";
import type { Selection } from "../lib/selection";
import type { TrashActionsApi } from "../lib/useTrashActions";
import { AppInfo } from "./AppInfo";
import { FolderAssignControl } from "./FolderAssignControl";
import { Inspector } from "./Inspector";
import { TrashActions } from "./TrashActions";

interface InspectorPaneProps {
  selectedCount: number;
  selection: Selection;
  selected: ItemMetadata | null;
  folders: readonly Folder[];
  libraryTagNames: string[];
  onSave: (id: ItemId, patch: ItemMetadataPatch) => Promise<void>;
  onAssignFolder: (ids: ItemId[], folderId: FolderId) => Promise<void>;
  onUnassignFolder: (ids: ItemId[], folderId: FolderId) => Promise<void>;
  onAddTags: (itemId: ItemId, tags: string[]) => Promise<void>;
  onRemoveTags: (itemId: ItemId, tags: string[]) => Promise<void>;
  trash: Pick<TrashActionsApi, "trashSelected" | "restoreSelected" | "purgeSelected">;
}

export function InspectorPane({
  selectedCount,
  selection,
  selected,
  folders,
  libraryTagNames,
  onSave,
  onAssignFolder,
  onUnassignFolder,
  onAddTags,
  onRemoveTags,
  trash,
}: InspectorPaneProps) {
  const multiIds = [...selection.ids];
  const folderList = [...folders];

  return (
    <aside className="inspector">
      {selectedCount > 1 ? (
        <div className="inspector-body">
          <p className="inspector-muted">{selectedCount} 件を選択中</p>
          <FolderAssignControl
            key={multiIds.sort().join("\n")}
            folders={folderList}
            onAssign={(folderId) => onAssignFolder(multiIds, folderId)}
            onUnassign={(folderId) => onUnassignFolder(multiIds, folderId)}
          />
        </div>
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
      <AppInfo />
    </aside>
  );
}

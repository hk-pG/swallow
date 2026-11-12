import { useMemo } from "react";
import { InspectorPane } from "../../features/inspector";
import type { AppSessionBrowser } from "../session/useAppSessionBrowser";
import type { AppSessionLibrary } from "../session/useAppSessionLibrary";
import type { AppSessionWorkspace } from "../session/useAppSessionWorkspace";

export function AppLayoutInspector({
  library,
  browser,
  workspace,
}: {
  library: AppSessionLibrary;
  browser: AppSessionBrowser;
  workspace: AppSessionWorkspace;
}) {
  const { saveItem, saveItems, items } = library;
  const { folders, tags, browser: itemBrowser } = browser;
  const { trash } = workspace;
  const selectedItems = useMemo(
    () => items.filter((item) => itemBrowser.selection.ids.has(item.id)),
    [items, itemBrowser.selection.ids],
  );

  return (
    <InspectorPane
      appearance={library.appearance}
      selectedCount={itemBrowser.selectedCount}
      selectedItems={selectedItems}
      selected={itemBrowser.selected}
      folders={folders.folders}
      libraryTagNames={tags.libraryTags?.tags ?? []}
      onSave={saveItem}
      onSaveItems={saveItems}
      onAssignFolder={(ids, folderId) => folders.assignToFolder(ids, folderId)}
      onUnassignFolder={(ids, folderId) => folders.unassignFromFolder(ids, folderId)}
      onAddTags={tags.addItemTags}
      onRemoveTags={tags.removeItemTags}
      onAddTagsToItems={tags.addTagsToItems}
      onRemoveTagsFromItems={tags.removeTagsFromItems}
      trash={trash}
    />
  );
}

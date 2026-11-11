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
  const { saveItem } = library;
  const { folders, tags, browser: itemBrowser } = browser;
  const { trash } = workspace;

  return (
    <InspectorPane
      selectedCount={itemBrowser.selectedCount}
      selection={itemBrowser.selection}
      selected={itemBrowser.selected}
      folders={folders.folders}
      libraryTagNames={tags.libraryTags?.tags ?? []}
      onSave={saveItem}
      onAssignFolder={(ids, folderId) => folders.assignToFolder(ids, folderId)}
      onUnassignFolder={(ids, folderId) => folders.unassignFromFolder(ids, folderId)}
      onAddTags={tags.addItemTags}
      onRemoveTags={tags.removeItemTags}
      trash={trash}
    />
  );
}

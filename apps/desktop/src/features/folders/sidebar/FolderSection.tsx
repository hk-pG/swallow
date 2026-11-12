import type { SidebarSectionProps } from "../../sidebar";
import { FolderTree } from "../components/FolderTree";
import { useFoldersApi } from "../hooks/FoldersContext";

/** Sidebar section: folder tree. State lives in `useFolders`, not in App. */
export function FolderSection({ libraryPath, view, onViewChange, disabled }: SidebarSectionProps) {
  const folders = useFoldersApi();

  return (
    <FolderTree
      key={libraryPath ?? ""}
      folders={folders.folders}
      selectedId={view.kind === "folder" ? view.folderId : null}
      disabled={disabled}
      onSelect={(id) => onViewChange({ kind: "folder", folderId: id })}
      onCreate={folders.onCreate}
      onRename={folders.onRename}
      onDelete={folders.onDelete}
      onMove={folders.onMove}
      onAssignItems={(itemIds, folderId) => folders.assignToFolder(itemIds, folderId)}
    />
  );
}

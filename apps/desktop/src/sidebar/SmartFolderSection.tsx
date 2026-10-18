import { SmartFolderNav } from "../components/SmartFolderNav";
import { useFoldersApi } from "./FoldersContext";
import { useSmartFoldersApi } from "./SmartFoldersContext";
import { useTagsApi } from "./TagsContext";
import type { SidebarSectionProps } from "./types";

/** Sidebar section: user-defined smart folders (saved searches). */
export function SmartFolderSection({
  libraryPath,
  view,
  onViewChange,
  disabled,
}: SidebarSectionProps) {
  const smartFolders = useSmartFoldersApi();
  const folders = useFoldersApi();
  const tags = useTagsApi();

  return (
    <SmartFolderNav
      key={libraryPath ?? ""}
      smartFolders={smartFolders.smartFolders}
      folders={folders.folders}
      libraryTags={tags.libraryTags?.tags ?? []}
      view={view}
      onChange={onViewChange}
      mutations={smartFolders}
      disabled={disabled}
    />
  );
}

import { useFoldersApi } from "../../folders/hooks/FoldersContext";
import type { SidebarSectionProps } from "../../sidebar/lib/types";
import { useTagsApi } from "../../tags/hooks/TagsContext";
import { SmartFolderNav } from "../components/SmartFolderNav";
import { useSmartFoldersApi } from "../hooks/SmartFoldersContext";

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

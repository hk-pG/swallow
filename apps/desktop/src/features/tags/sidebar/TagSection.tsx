import type { SidebarSectionProps } from "../../sidebar";
import { TagNav } from "../components/TagNav";
import { useTagsApi } from "../hooks/TagsContext";

/** Sidebar section: tag list by group. State lives in `useTags`, not in App. */
export function TagSection({ libraryPath, view, onViewChange, disabled }: SidebarSectionProps) {
  const tags = useTagsApi();

  return (
    <TagNav
      key={libraryPath ?? ""}
      libraryTags={tags.libraryTags}
      view={view}
      onChange={onViewChange}
      mutations={{
        addTag: tags.addTag,
        removeTag: tags.removeTag,
        createGroup: tags.createGroup,
        deleteGroup: tags.deleteGroup,
        setTagGroup: tags.setTagGroup,
      }}
      disabled={disabled}
    />
  );
}

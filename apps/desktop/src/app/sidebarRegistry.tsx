import { ColorLabelSection } from "../features/color-labels/sidebar/ColorLabelSection";
import { FolderSection } from "../features/folders/sidebar/FolderSection";
import type { SidebarSectionEntry, SidebarSectionProps } from "../features/sidebar/lib/types";
import { SmartFolderSection } from "../features/smart-folders/sidebar/SmartFolderSection";
import { SmartViewSection } from "../features/smart-views/sidebar/SmartViewSection";
import { TagSection } from "../features/tags/sidebar/TagSection";

export type { SidebarSectionEntry, SidebarSectionProps } from "../features/sidebar/lib/types";

/**
 * Ordered sidebar sections. Feature UIs append an entry here —
 * App does not gain useState or effects for those sections.
 */
export const sidebarSections: SidebarSectionEntry[] = [
  { id: "smart-views", Component: SmartViewSection },
  { id: "smart-folders", Component: SmartFolderSection },
  { id: "folders", Component: FolderSection },
  { id: "color-labels", Component: ColorLabelSection },
  { id: "tags", Component: TagSection },
];

export function SidebarSections(props: SidebarSectionProps) {
  return (
    <>
      {sidebarSections.map(({ id, Component }) => (
        <Component key={id} {...props} />
      ))}
    </>
  );
}

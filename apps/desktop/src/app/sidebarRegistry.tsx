import { ColorLabelSection } from "../features/color-labels";
import { FolderSection } from "../features/folders";
import type { SidebarSectionEntry, SidebarSectionProps } from "../features/sidebar";
import { SmartFolderSection } from "../features/smart-folders";
import { SmartViewSection } from "../features/smart-views";
import { TagSection } from "../features/tags";

export type { SidebarSectionEntry, SidebarSectionProps } from "../features/sidebar";

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

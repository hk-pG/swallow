import { ColorLabelSection } from "./ColorLabelSection";
import { FolderSection } from "./FolderSection";
import { SmartFolderSection } from "./SmartFolderSection";
import { SmartViewSection } from "./SmartViewSection";
import { TagSection } from "./TagSection";
import type { SidebarSectionEntry, SidebarSectionProps } from "./types";

export type { SidebarSectionEntry, SidebarSectionProps } from "./types";

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

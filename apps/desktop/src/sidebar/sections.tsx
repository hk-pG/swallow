import { FolderSection } from "./FolderSection";
import { SmartViewSection } from "./SmartViewSection";
import type { SidebarSectionEntry, SidebarSectionProps } from "./types";

export type { SidebarSectionEntry, SidebarSectionProps } from "./types";

/**
 * Ordered sidebar sections. Add tag (#24) UI by appending an entry —
 * App does not gain useState or effects for those sections.
 */
export const sidebarSections: SidebarSectionEntry[] = [
  { id: "smart-views", Component: SmartViewSection },
  { id: "folders", Component: FolderSection },
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

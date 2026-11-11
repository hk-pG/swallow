import { ColorLabelSection } from "../features/color-labels";
import { FolderSection } from "../features/folders";
import type { SidebarSectionProps } from "../features/sidebar";
import { SmartFolderSection } from "../features/smart-folders";
import { SmartViewSection } from "../features/smart-views";
import { TagSection } from "../features/tags";
import { assertValidSidebarRegistry } from "./assertValidSidebarRegistry";
import type { AppSidebarSectionEntry } from "./sidebarRegistryTypes";

export type { SidebarSectionEntry, SidebarSectionProps } from "../features/sidebar";
export type { AppSidebarSectionEntry } from "./sidebarRegistryTypes";

/**
 * Ordered sidebar sections. Feature UIs append an entry here —
 * App does not gain useState or effects for those sections.
 */
export const sidebarSections: AppSidebarSectionEntry[] = [
  { id: "smart-views", Component: SmartViewSection, requiredProviders: [] },
  {
    id: "smart-folders",
    Component: SmartFolderSection,
    requiredProviders: ["folders", "smart-folders", "tags"],
  },
  { id: "folders", Component: FolderSection, requiredProviders: ["folders"] },
  { id: "color-labels", Component: ColorLabelSection, requiredProviders: [] },
  { id: "tags", Component: TagSection, requiredProviders: ["tags"] },
];

assertValidSidebarRegistry(sidebarSections);

export function SidebarSections(props: SidebarSectionProps) {
  return (
    <>
      {sidebarSections.map(({ id, Component }) => (
        <Component key={id} {...props} />
      ))}
    </>
  );
}

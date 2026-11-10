import type { ItemView } from "@swallow/shared";
import type { ComponentType } from "react";

/** Shared props for every sidebar section. Sections keep their own state. */
export interface SidebarSectionProps {
  libraryPath: string | null;
  view: ItemView;
  onViewChange: (view: ItemView) => void;
  disabled: boolean;
}

export interface SidebarSectionEntry {
  id: string;
  Component: ComponentType<SidebarSectionProps>;
}

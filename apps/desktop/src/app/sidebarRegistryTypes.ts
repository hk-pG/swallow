import type { SidebarSectionEntry } from "../features/sidebar";
import type { AppFeatureProviderId } from "./appFeatureProviders";

/** Sidebar registry row: section UI plus declared feature-provider dependencies. */
export type AppSidebarSectionEntry = SidebarSectionEntry & {
  requiredProviders: readonly AppFeatureProviderId[];
};

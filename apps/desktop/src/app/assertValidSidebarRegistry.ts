import type { SidebarSectionEntry } from "../features/sidebar";

/** Fail fast when a sidebar section entry is mis-registered. */
export function assertValidSidebarRegistry(entries: readonly SidebarSectionEntry[]): void {
  if (entries.length === 0) {
    throw new Error("sidebarSections: at least one section is required");
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    const id = entry.id.trim();
    if (!id) {
      throw new Error("sidebarSections: every entry must have a non-empty id");
    }
    if (seen.has(id)) {
      throw new Error(`sidebarSections: duplicate id "${id}"`);
    }
    seen.add(id);
    if (typeof entry.Component !== "function") {
      throw new Error(`sidebarSections: "${id}" must have a mountable Component`);
    }
  }
}

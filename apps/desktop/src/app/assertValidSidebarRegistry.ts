import { APP_FEATURE_PROVIDER_IDS } from "./appFeatureProviders";
import type { AppSidebarSectionEntry } from "./sidebarRegistryTypes";

const knownProviderIds = new Set<string>(APP_FEATURE_PROVIDER_IDS);

/** Fail fast when a sidebar section entry is mis-registered. */
export function assertValidSidebarRegistry(entries: readonly AppSidebarSectionEntry[]): void {
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
    if (!Array.isArray(entry.requiredProviders)) {
      throw new Error(`sidebarSections: "${id}" must declare requiredProviders`);
    }
    const seenProviders = new Set<string>();
    for (const providerId of entry.requiredProviders) {
      const normalized = providerId.trim();
      if (!normalized) {
        throw new Error(`sidebarSections: "${id}" has a blank requiredProviders id`);
      }
      if (!knownProviderIds.has(normalized)) {
        throw new Error(`sidebarSections: "${id}" references unknown provider "${normalized}"`);
      }
      if (seenProviders.has(normalized)) {
        throw new Error(
          `sidebarSections: "${id}" lists duplicate requiredProviders id "${normalized}"`,
        );
      }
      seenProviders.add(normalized);
    }
  }
}

import type { AppSession } from "./useAppSession";

const noopAsync = async () => {};

/** Minimal feature APIs for AppProviders / sidebar mount tests. */
export function minimalProviderSession(): Pick<
  AppSession["browser"],
  "folders" | "smartFolders" | "tags"
> {
  return {
    folders: {
      folders: [],
      reload: noopAsync,
      onCreate: noopAsync,
      onRename: noopAsync,
      onDelete: noopAsync,
      onMove: noopAsync,
      assignToFolder: noopAsync,
      unassignFromFolder: noopAsync,
    },
    smartFolders: {
      smartFolders: [],
      onCreate: noopAsync,
      onRename: noopAsync,
      onUpdateCriteria: noopAsync,
      onDelete: noopAsync,
    },
    tags: {
      libraryTags: null,
      addTag: noopAsync,
      removeTag: noopAsync,
      createGroup: noopAsync,
      deleteGroup: noopAsync,
      setTagGroup: noopAsync,
      addItemTags: noopAsync,
      removeItemTags: noopAsync,
    },
  };
}

export function asAppSession(
  partial: Pick<AppSession["browser"], "folders" | "smartFolders" | "tags">,
): AppSession {
  return {
    browser: partial as AppSession["browser"],
    library: {} as AppSession["library"],
    workspace: {} as AppSession["workspace"],
  };
}

import type { ItemId, ItemView, LibraryTags } from "@swallow/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  addItemTags,
  addTag,
  createTagGroup,
  deleteTagGroup,
  getLibraryTags,
  removeItemTags,
  removeTag,
  setTagGroup,
} from "./commands";
import { nextViewAfterTagChange } from "./tags";

export interface TagsApi {
  libraryTags: LibraryTags | null;
  addTag: (tag: string) => Promise<void>;
  removeTag: (tag: string) => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  setTagGroup: (tag: string, groupId: string | null) => Promise<void>;
  addItemTags: (itemId: ItemId, tags: string[]) => Promise<void>;
  removeItemTags: (itemId: ItemId, tags: string[]) => Promise<void>;
}

interface Options {
  libraryPath: string | null;
  /** Reload the item grid after tag or membership changes. */
  invalidateItems: () => Promise<void>;
  setView: Dispatch<SetStateAction<ItemView>>;
}

/**
 * Library tag state and mutations. Sidebar and inspector share this module;
 * App only mounts it and does not own tag `useState` inline.
 */
export function useTags({ libraryPath, invalidateItems, setView }: Options): TagsApi {
  const [libraryTags, setLibraryTags] = useState<LibraryTags | null>(null);

  const tagsSeq = useRef(0);
  const applyLibraryTags = useCallback(
    (tags: LibraryTags) => {
      setLibraryTags(tags);
      setView((current) => nextViewAfterTagChange(current, tags));
    },
    [setView],
  );

  const reloadTags = useCallback(async (): Promise<LibraryTags | null> => {
    const seq = ++tagsSeq.current;
    if (!libraryPath) {
      setLibraryTags(null);
      return null;
    }
    try {
      const tags = await getLibraryTags(libraryPath);
      if (seq !== tagsSeq.current) return null;
      applyLibraryTags(tags);
      return tags;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [libraryPath, applyLibraryTags]);

  useEffect(() => {
    setLibraryTags(null);
    setView((current) => (current.kind === "tag" ? { kind: "all" } : current));
    void reloadTags();
  }, [reloadTags, setView]);

  const requireLibrary = () => {
    if (!libraryPath) throw new Error("ライブラリが開かれていません");
    return libraryPath;
  };

  const withTagMutation = async (action: (path: string) => Promise<LibraryTags>) => {
    applyLibraryTags(await action(requireLibrary()));
    await invalidateItems();
  };

  return {
    libraryTags,
    addTag: (tag) => withTagMutation((path) => addTag(path, tag)),
    removeTag: (tag) => withTagMutation((path) => removeTag(path, tag)),
    createGroup: (name) => withTagMutation((path) => createTagGroup(path, name)),
    deleteGroup: (groupId) => withTagMutation((path) => deleteTagGroup(path, groupId)),
    setTagGroup: (tag, groupId) => withTagMutation((path) => setTagGroup(path, tag, groupId)),
    addItemTags: async (itemId, tags) => {
      applyLibraryTags(await addItemTags(requireLibrary(), [itemId], tags));
      await invalidateItems();
    },
    removeItemTags: async (itemId, tags) => {
      await removeItemTags(requireLibrary(), [itemId], tags);
      await invalidateItems();
    },
  };
}

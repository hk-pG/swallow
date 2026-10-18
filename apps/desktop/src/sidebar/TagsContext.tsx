import { createContext, useContext } from "react";
import type { TagsApi } from "../lib/useTags";

const TagsContext = createContext<TagsApi | null>(null);

export const TagsProvider = TagsContext.Provider;

/** Tag API mounted by App; sidebar section and inspector consumers share it. */
export function useTagsApi(): TagsApi {
  const api = useContext(TagsContext);
  if (!api) throw new Error("TagsProvider がありません");
  return api;
}

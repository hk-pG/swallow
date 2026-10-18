import { createContext, useContext } from "react";
import type { FoldersApi } from "../lib/useFolders";

const FoldersContext = createContext<FoldersApi | null>(null);

export const FoldersProvider = FoldersContext.Provider;

/** Folder tree API mounted by App; sidebar section and inspector consumers share it. */
export function useFoldersApi(): FoldersApi {
  const api = useContext(FoldersContext);
  if (!api) throw new Error("FoldersProvider がありません");
  return api;
}

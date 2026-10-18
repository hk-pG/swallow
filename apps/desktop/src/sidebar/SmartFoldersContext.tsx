import { createContext, useContext } from "react";
import type { SmartFoldersApi } from "../lib/useSmartFolders";

const SmartFoldersContext = createContext<SmartFoldersApi | null>(null);

export const SmartFoldersProvider = SmartFoldersContext.Provider;

export function useSmartFoldersApi(): SmartFoldersApi {
  const api = useContext(SmartFoldersContext);
  if (!api) throw new Error("SmartFoldersProvider がありません");
  return api;
}

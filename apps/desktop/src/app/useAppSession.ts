import { useAppSessionBrowser } from "./session/useAppSessionBrowser";
import { useAppSessionLibrary } from "./session/useAppSessionLibrary";
import { useAppSessionWorkspace } from "./session/useAppSessionWorkspace";

export function useAppSession() {
  const library = useAppSessionLibrary();
  const browser = useAppSessionBrowser(library);
  const workspace = useAppSessionWorkspace(library, browser);

  return { library, browser, workspace };
}

export type AppSession = ReturnType<typeof useAppSession>;

export type { AppSessionBrowser } from "./session/useAppSessionBrowser";
export type { AppSessionLibrary } from "./session/useAppSessionLibrary";
export type { AppSessionWorkspace } from "./session/useAppSessionWorkspace";

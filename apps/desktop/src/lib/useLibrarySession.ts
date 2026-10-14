import type { LibraryInfo } from "@swallow/shared";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { createLibrary, getRecentLibraries, openLibrary, restoreLibrary } from "./commands";

export interface LibrarySession {
  library: LibraryInfo | null;
  /** `library?.path ?? null` — children that only need the open path use this. */
  libraryPath: string | null;
  recent: string[];
  error: string | null;
  setError: (error: string | null) => void;
  handleCreate: () => Promise<void>;
  handleOpen: () => Promise<void>;
  openPath: (path: string) => Promise<void>;
}

/** Owns create / open / restore and the recent-libraries list. */
export function useLibrarySession(): LibrarySession {
  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshRecent = useCallback(() => {
    getRecentLibraries().then(setRecent).catch(console.error);
  }, []);

  useEffect(() => {
    restoreLibrary()
      .then(setLibrary)
      .catch((e) => setError(String(e)))
      .finally(refreshRecent);
  }, [refreshRecent]);

  const run = async (action: (path: string) => Promise<LibraryInfo>, path: string) => {
    try {
      setLibrary(await action(path));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      refreshRecent();
    }
  };

  const pickDirectory = async (title: string) => {
    const path = await open({ directory: true, title });
    return typeof path === "string" ? path : null;
  };

  const handleCreate = async () => {
    const path = await pickDirectory("新規ライブラリにする空のフォルダを選択");
    if (path) await run(createLibrary, path);
  };

  const handleOpen = async () => {
    const path = await pickDirectory("ライブラリを開く");
    if (path) await run(openLibrary, path);
  };

  const openPath = async (path: string) => {
    await run(openLibrary, path);
  };

  return {
    library,
    libraryPath: library?.path ?? null,
    recent,
    error,
    setError,
    handleCreate,
    handleOpen,
    openPath,
  };
}

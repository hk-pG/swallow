import {
  EMPTY_SMART_FOLDER_CRITERIA,
  type ItemView,
  type SmartFolder,
  type SmartFolderCriteria,
} from "@swallow/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createSmartFolder,
  deleteSmartFolder,
  listSmartFolders,
  renameSmartFolder,
  updateSmartFolder,
} from "./commands";
import { nextViewAfterSmartFolderChange } from "./smartFolders";
import { useLatest } from "./useLatest";

export interface SmartFoldersApi {
  smartFolders: SmartFolder[];
  onCreate: (name: string, criteria?: SmartFolderCriteria) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onUpdateCriteria: (id: string, criteria: SmartFolderCriteria) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface Options {
  libraryPath: string | null;
  setView: Dispatch<SetStateAction<ItemView>>;
}

export function useSmartFolders({ libraryPath, setView }: Options): SmartFoldersApi {
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([]);
  const setViewRef = useLatest(setView);

  const seq = useRef(0);
  const applyLibrary = useCallback(
    (library: SmartFolder[]) => {
      setSmartFolders(library);
      setViewRef.current((current) =>
        nextViewAfterSmartFolderChange(current, { folders: library }),
      );
    },
    [setViewRef],
  );

  const reload = useCallback(async (): Promise<SmartFolder[] | null> => {
    const current = ++seq.current;
    if (!libraryPath) {
      setSmartFolders([]);
      return [];
    }
    try {
      const next = await listSmartFolders(libraryPath);
      if (current !== seq.current) return null;
      applyLibrary(next);
      return next;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [libraryPath, applyLibrary]);

  useEffect(() => {
    setSmartFolders([]);
    setViewRef.current((current) => (current.kind === "smartFolder" ? { kind: "all" } : current));
    void reload();
  }, [reload, setViewRef]);

  const requireLibrary = () => {
    if (!libraryPath) throw new Error("ライブラリが開かれていません");
    return libraryPath;
  };

  const onCreate = async (name: string, criteria = EMPTY_SMART_FOLDER_CRITERIA) => {
    const path = requireLibrary();
    const created = await createSmartFolder(path, name, criteria);
    await reload();
    setView({ kind: "smartFolder", smartFolderId: created.id });
  };

  const onRename = async (id: string, name: string) => {
    await renameSmartFolder(requireLibrary(), id, name);
    await reload();
  };

  const onUpdateCriteria = async (id: string, criteria: SmartFolderCriteria) => {
    await updateSmartFolder(requireLibrary(), id, criteria);
    await reload();
  };

  const onDelete = async (id: string) => {
    await deleteSmartFolder(requireLibrary(), id);
    await reload();
  };

  return {
    smartFolders,
    onCreate,
    onRename,
    onUpdateCriteria,
    onDelete,
  };
}

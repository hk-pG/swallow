import type { ReactNode } from "react";
import { FoldersProvider } from "../features/folders/hooks/FoldersContext";
import { SmartFoldersProvider } from "../features/smart-folders/hooks/SmartFoldersContext";
import { TagsProvider } from "../features/tags/hooks/TagsContext";
import type { AppSession } from "./useAppSession";

export function AppProviders({ session, children }: { session: AppSession; children: ReactNode }) {
  const { folders, smartFolders, tags } = session;
  return (
    <FoldersProvider value={folders}>
      <SmartFoldersProvider value={smartFolders}>
        <TagsProvider value={tags}>{children}</TagsProvider>
      </SmartFoldersProvider>
    </FoldersProvider>
  );
}

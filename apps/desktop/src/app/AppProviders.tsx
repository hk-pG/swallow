import type { ReactNode } from "react";
import { FoldersProvider } from "../features/folders";
import { SmartFoldersProvider } from "../features/smart-folders";
import { TagsProvider } from "../features/tags";
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

import type { ReactNode } from "react";
import { FoldersProvider } from "../features/folders";
import { SmartFoldersProvider } from "../features/smart-folders";
import { TagsProvider } from "../features/tags";
import type { AppSession } from "./useAppSession";

type SessionFolders = AppSession["folders"];
type SessionSmartFolders = AppSession["smartFolders"];
type SessionTags = AppSession["tags"];

export interface AppFeatureProviderSpec {
  id: string;
  selectValue: (session: AppSession) => SessionFolders | SessionSmartFolders | SessionTags;
  wrap: (
    value: SessionFolders | SessionSmartFolders | SessionTags,
    children: ReactNode,
  ) => ReactNode;
}

/** Outermost first — nested by `composeAppFeatureProviders`. */
export const APP_FEATURE_PROVIDERS: AppFeatureProviderSpec[] = [
  {
    id: "folders",
    selectValue: (session) => session.folders,
    wrap: (value, children) => (
      <FoldersProvider value={value as SessionFolders}>{children}</FoldersProvider>
    ),
  },
  {
    id: "smart-folders",
    selectValue: (session) => session.smartFolders,
    wrap: (value, children) => (
      <SmartFoldersProvider value={value as SessionSmartFolders}>{children}</SmartFoldersProvider>
    ),
  },
  {
    id: "tags",
    selectValue: (session) => session.tags,
    wrap: (value, children) => <TagsProvider value={value as SessionTags}>{children}</TagsProvider>,
  },
];

export function assertUniqueAppFeatureProviderIds(specs: readonly { id: string }[]): void {
  const seen = new Set<string>();
  for (const spec of specs) {
    const id = spec.id.trim();
    if (!id) throw new Error("APP_FEATURE_PROVIDERS: every entry must have a non-empty id");
    if (seen.has(id)) {
      throw new Error(`APP_FEATURE_PROVIDERS: duplicate id "${id}"`);
    }
    seen.add(id);
  }
}

assertUniqueAppFeatureProviderIds(APP_FEATURE_PROVIDERS);

export function composeAppFeatureProviders(session: AppSession, children: ReactNode): ReactNode {
  return APP_FEATURE_PROVIDERS.reduceRight<ReactNode>((tree, spec) => {
    const value = spec.selectValue(session);
    return spec.wrap(value, tree);
  }, children);
}

import { installDocumentTheme } from "../features/settings";
import { installDisableDefaultContextMenu } from "../platform/disableDefaultContextMenu";

export function bootstrapApp(): void {
  installDisableDefaultContextMenu();
  installDocumentTheme(window.matchMedia("(prefers-color-scheme: dark)"));
}

import { installDocumentTheme } from "../features/settings";
import { installDisableDefaultContextMenu } from "../platform/disableDefaultContextMenu";
import { installDiagnosticLog } from "../shared/diagnostic-log";

export function bootstrapApp(): void {
  installDisableDefaultContextMenu();
  installDocumentTheme(window.matchMedia("(prefers-color-scheme: dark)"));
  void installDiagnosticLog();
}

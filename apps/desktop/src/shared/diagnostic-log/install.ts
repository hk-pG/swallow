import { isTauri } from "@tauri-apps/api/core";
import { getDiagnosticLogger, setDiagnosticLogger } from "./logger";
import { createTauriDiagnosticLogger } from "./tauriLogger";

/** Installs the Tauri diagnostic logger when running inside the desktop shell. */
export async function installDiagnosticLog(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  setDiagnosticLogger(createTauriDiagnosticLogger());
  getDiagnosticLogger().info("diagnostic logger ready");
}

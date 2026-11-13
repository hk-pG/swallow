import { type DiagnosticLogger, formatDiagnosticMessage } from "./logger";
import type { DiagnosticLogFields, DiagnosticLogLevel } from "./types";

/**
 * Tauri `plugin-log` backend. This is the only module that imports `@tauri-apps/plugin-log`.
 */
export function createTauriDiagnosticLogger(): DiagnosticLogger {
  return {
    log(level, message, fields) {
      void writeTauriLog(level, message, fields);
    },
    trace: (m, f) => {
      void writeTauriLog("trace", m, f);
    },
    debug: (m, f) => {
      void writeTauriLog("debug", m, f);
    },
    info: (m, f) => {
      void writeTauriLog("info", m, f);
    },
    warn: (m, f) => {
      void writeTauriLog("warn", m, f);
    },
    error: (m, f) => {
      void writeTauriLog("error", m, f);
    },
  };
}

async function writeTauriLog(
  level: DiagnosticLogLevel,
  message: string,
  fields?: DiagnosticLogFields,
): Promise<void> {
  const payload = formatDiagnosticMessage(message, fields);
  const plugin = await import("@tauri-apps/plugin-log");
  switch (level) {
    case "trace":
      await plugin.trace(payload);
      break;
    case "debug":
      await plugin.debug(payload);
      break;
    case "info":
      await plugin.info(payload);
      break;
    case "warn":
      await plugin.warn(payload);
      break;
    case "error":
      await plugin.error(payload);
      break;
  }
}

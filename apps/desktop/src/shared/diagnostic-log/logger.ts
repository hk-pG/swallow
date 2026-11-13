import type { DiagnosticLogFields, DiagnosticLogLevel } from "./types";

export type DiagnosticLogger = {
  log(level: DiagnosticLogLevel, message: string, fields?: DiagnosticLogFields): void;
  trace(message: string, fields?: DiagnosticLogFields): void;
  debug(message: string, fields?: DiagnosticLogFields): void;
  info(message: string, fields?: DiagnosticLogFields): void;
  warn(message: string, fields?: DiagnosticLogFields): void;
  error(message: string, fields?: DiagnosticLogFields): void;
};

let activeLogger: DiagnosticLogger = createNoopDiagnosticLogger();

export function setDiagnosticLogger(logger: DiagnosticLogger): void {
  activeLogger = logger;
}

export function getDiagnosticLogger(): DiagnosticLogger {
  return activeLogger;
}

export function resetDiagnosticLogger(): void {
  activeLogger = createNoopDiagnosticLogger();
}

export function createNoopDiagnosticLogger(): DiagnosticLogger {
  const log = () => {};
  return {
    log: () => {},
    trace: log,
    debug: log,
    info: log,
    warn: log,
    error: log,
  };
}

export function createCollectingDiagnosticLogger(
  sink: Array<{ level: DiagnosticLogLevel; message: string; fields?: DiagnosticLogFields }>,
): DiagnosticLogger {
  const write = (level: DiagnosticLogLevel, message: string, fields?: DiagnosticLogFields) => {
    sink.push({ level, message, fields });
  };
  return {
    log: write,
    trace: (m, f) => write("trace", m, f),
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
  };
}

function formatFields(fields?: DiagnosticLogFields): string {
  if (!fields) {
    return "";
  }
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return "";
  }
  return ` ${JSON.stringify(Object.fromEntries(entries))}`;
}

/** Serializes message + structured fields for backends that accept a single string. */
export function formatDiagnosticMessage(message: string, fields?: DiagnosticLogFields): string {
  return `${message}${formatFields(fields)}`;
}

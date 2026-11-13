import { getDiagnosticLogger } from "./logger";
import { truncateDiagnosticMessage } from "./message";
import type { DiagnosticLogFields } from "./types";

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return truncateDiagnosticMessage(raw);
}

/** Logs an unexpected failure from app code (replaces bare `console.error` in hooks). */
export function reportDiagnosticError(
  component: string,
  error: unknown,
  extra?: DiagnosticLogFields,
): void {
  const fields: DiagnosticLogFields = {
    source: "app",
    component,
    errorMessage: errorMessage(error),
    ...extra,
  };
  getDiagnosticLogger().error(errorMessage(error), fields);
}

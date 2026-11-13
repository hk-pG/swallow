import { getDiagnosticLogger } from "./logger";
import type { DiagnosticLogFields } from "./types";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

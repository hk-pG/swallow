export type DiagnosticLogLevel = "trace" | "debug" | "info" | "warn" | "error";

/** Structured fields attached to a diagnostic log line (values are JSON-serializable). */
export type DiagnosticLogFields = Record<string, string | number | boolean | null | undefined>;

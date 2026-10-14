import type { ItemMetadata } from "./library";

/** Lowercase, without the leading dot. Mirrors `SUPPORTED_EXTENSIONS` in `src-tauri/src/import.rs`. */
export const SUPPORTED_IMPORT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "pdf",
] as const;

export type ImportFailureReason = "unsupportedExtension" | "notFound" | "notAFile" | "io";

export interface ImportFailure {
  /** Source path as given */
  path: string;
  reason: ImportFailureReason;
  message: string;
}

/** Result of the `import_assets` Tauri command */
export interface ImportReport {
  imported: ItemMetadata[];
  failed: ImportFailure[];
}

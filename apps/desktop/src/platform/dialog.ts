import { open } from "@tauri-apps/plugin-dialog";

type OpenOptions = Parameters<typeof open>[0];

function normalizeSelection(selected: string | string[] | null): string[] {
  if (!selected) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

/** Resolves to an empty array when the dialog is cancelled. */
export async function pickFiles(options: OpenOptions): Promise<string[]> {
  const selected = await open(options);
  return normalizeSelection(selected);
}

/** Resolves to an empty array when the dialog is cancelled. */
export async function pickFolders(options: OpenOptions): Promise<string[]> {
  const selected = await open({ ...options, directory: true });
  return normalizeSelection(selected);
}

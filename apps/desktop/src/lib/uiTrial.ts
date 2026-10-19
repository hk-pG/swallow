/** Experimental UI trials layered on top of the default theme. Revert by clearing the flag. */
export type UiTrialId = "apple-hig" | "off";

export const UI_TRIAL_STORAGE_KEY = "swallow.uiTrial";
export const DEFAULT_UI_TRIAL: UiTrialId = "apple-hig";

export function parseUiTrial(raw: string | null | undefined): UiTrialId {
  if (raw === "off" || raw === "apple-hig") return raw;
  return DEFAULT_UI_TRIAL;
}

export function readUiTrial(): UiTrialId {
  try {
    return parseUiTrial(globalThis.localStorage?.getItem(UI_TRIAL_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_TRIAL;
  }
}

export function writeUiTrial(trial: UiTrialId): void {
  try {
    if (trial === DEFAULT_UI_TRIAL) {
      globalThis.localStorage?.removeItem(UI_TRIAL_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(UI_TRIAL_STORAGE_KEY, trial);
    }
  } catch {
    // Ignore quota / private-mode failures; in-memory state still applies.
  }
}

/** Applies or clears `data-ui-trial` on `<html>` for CSS overrides. */
export function applyUiTrialToDocument(trial: UiTrialId): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (trial === "off") {
    root.removeAttribute("data-ui-trial");
  } else {
    root.setAttribute("data-ui-trial", trial);
  }
}

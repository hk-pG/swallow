function homePrefixes(): string[] {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  if (!env) {
    return [];
  }
  return [env.HOME, env.USERPROFILE].filter((value): value is string => Boolean(value?.trim()));
}

function stripHomePrefix(path: string): string | null {
  for (const home of homePrefixes()) {
    const trimmedHome = home.replace(/[/\\]+$/, "");
    const withSlash = `${trimmedHome}/`;
    const withBackslash = `${trimmedHome}\\`;
    if (path.startsWith(withSlash)) {
      return `/${path.slice(withSlash.length)}`;
    }
    if (path.startsWith(withBackslash)) {
      return `/${path.slice(withBackslash.length)}`;
    }
  }
  return null;
}

/**
 * Masks filesystem paths for logs (item id / extension preferred; full library root omitted).
 * Aligned with Rust `mask_path` (HOME / USERPROFILE → `~` prefix, else last two segments).
 */
export function maskPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return "";
  }

  const homeStripped = stripHomePrefix(trimmed);
  if (homeStripped !== null) {
    return `~${homeStripped}`;
  }

  const normalized = trimmed.replaceAll("\\", "/");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  if (parts.length <= 2) {
    return normalized;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

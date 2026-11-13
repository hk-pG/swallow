/**
 * Masks filesystem paths for logs (item id / extension preferred; full library root omitted).
 */
export function maskPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replaceAll("\\", "/");
  const parts = normalized.split("/").filter((p) => p.length > 0);
  if (parts.length <= 2) {
    return normalized;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

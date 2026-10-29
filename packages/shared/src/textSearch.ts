import type { ItemMetadata } from "./library";

export function normalizeSearchText(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** Splits on whitespace (including full-width spaces). */
export function parseQueryTerms(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

/** Every term must appear in name, annotation, or tags (case-insensitive). */
export function matchesQueryTerms(item: ItemMetadata, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystacks = [item.name, item.annotation, ...item.tags].map(normalizeSearchText);
  return terms.every((term) => haystacks.some((text) => text.includes(term)));
}

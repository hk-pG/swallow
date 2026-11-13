/** Max length for `errorMessage` and similar free-text diagnostic fields (#183). */
export const DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN = 512;

const TRUNCATION_ELLIPSIS = "…";

export function truncateDiagnosticMessage(text: string): string {
  if ([...text].length <= DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN) {
    return text;
  }
  const ellipsisLen = [...TRUNCATION_ELLIPSIS].length;
  const take = Math.max(0, DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN - ellipsisLen);
  return `${[...text].slice(0, take).join("")}${TRUNCATION_ELLIPSIS}`;
}

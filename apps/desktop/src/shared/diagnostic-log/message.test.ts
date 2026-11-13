import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN, truncateDiagnosticMessage } from "./message";

describe("truncateDiagnosticMessage", () => {
  it("leaves short text unchanged", () => {
    expect(truncateDiagnosticMessage("ok")).toBe("ok");
  });

  it("truncates with ellipsis marker at 512 chars", () => {
    const long = "x".repeat(DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN + 20);
    const out = truncateDiagnosticMessage(long);
    expect([...out].length).toBe(DIAGNOSTIC_ERROR_MESSAGE_MAX_LEN);
    expect(out.endsWith("…")).toBe(true);
  });
});

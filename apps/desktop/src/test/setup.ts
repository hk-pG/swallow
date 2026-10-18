import { vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string, scheme: string) => `${scheme}://localhost/${path}`,
}));

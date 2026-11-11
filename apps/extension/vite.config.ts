import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: "node",
  },
  build: {
    target: "chrome120",
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        background: path.resolve(root, "src/background.ts"),
        popup: path.resolve(root, "src/popup.ts"),
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
      },
    },
  },
});

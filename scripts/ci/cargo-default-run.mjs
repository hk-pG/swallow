#!/usr/bin/env node
/**
 * Ensures the desktop crate declares default-run so `cargo run` (and Tauri dev)
 * selects the app binary when optional perf-bin targets exist.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = path.join(repoRoot, "apps/desktop/src-tauri/Cargo.toml");
const expected = "swallow";

let metadata;
try {
  const raw = execFileSync(
    "cargo",
    ["metadata", "--no-deps", "--format-version", "1", "--manifest-path", manifest],
    { encoding: "utf8", cwd: repoRoot },
  );
  metadata = JSON.parse(raw);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: cargo metadata failed: ${msg}`);
  process.exit(1);
}

const pkg = metadata.packages?.find((p) => p.name === "swallow");
if (!pkg) {
  console.error("FAIL: swallow package not found in cargo metadata");
  process.exit(1);
}

const defaultRun = pkg.default_run ?? null;
if (defaultRun !== expected) {
  console.error(
    `FAIL: apps/desktop/src-tauri default-run is ${JSON.stringify(defaultRun)}; expected ${JSON.stringify(expected)}`,
  );
  process.exit(1);
}

console.log("ok");

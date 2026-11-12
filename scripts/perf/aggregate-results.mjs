import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const resultsDir = process.argv[2];
const outPath = process.argv[3];
if (!resultsDir || !outPath) {
  console.error("usage: aggregate-results.mjs <resultsDir> <summary.json>");
  process.exit(1);
}

function load(name) {
  const path = join(resultsDir, name);
  return JSON.parse(readFileSync(path, "utf8"));
}

const summary = {
  environment: load("environment.json"),
  libraries: {
    10000: {
      rustList: load("rust-list-10000.json"),
      rustImport: load("rust-import-10000.json"),
      frontend: load("frontend-10000.json"),
    },
    50000: {
      rustList: load("rust-list-50000.json"),
      rustImport: load("rust-import-50000.json"),
      frontend: load("frontend-50000.json"),
    },
  },
};
writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

import { writeFileSync } from "node:fs";
import { collectEnvironment } from "./env.mjs";

const repoRoot = process.argv[2];
const outPath = process.argv[3];
if (!repoRoot || !outPath) {
  console.error("usage: collect-env.mjs <repoRoot> <out.json>");
  process.exit(1);
}
const env = collectEnvironment(repoRoot);
writeFileSync(outPath, `${JSON.stringify(env, null, 2)}\n`);

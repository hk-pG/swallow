// pnpm は Windows で lifecycle script を cmd.exe に渡す。
// `scripts/agent/install-hooks.sh` をそのまま書くと、cmd が `/` をスイッチとみなして
// コマンド名が `scripts` になり install が失敗する。最初のトークンを `node` にして回避する。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "install-hooks.sh");

function gitBashCandidates() {
  const roots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LocalAppData ? path.join(process.env.LocalAppData, "Programs") : "",
  ].filter((root) => root);
  const candidates = [];
  for (const root of roots) {
    candidates.push(path.join(root, "Git", "bin", "bash.exe"));
    candidates.push(path.join(root, "Git", "usr", "bin", "bash.exe"));
  }
  return candidates;
}

function bashCommands() {
  if (process.platform !== "win32") {
    return ["bash"];
  }
  return ["bash", ...gitBashCandidates()];
}

function run(command) {
  return spawnSync(command, [script], { stdio: "inherit" });
}

let lastError;
for (const command of bashCommands()) {
  if (command.includes("\\") && !existsSync(command)) {
    continue;
  }
  const result = run(command);
  if (result.error?.code === "ENOENT") {
    lastError = result.error;
    continue;
  }
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

console.error("error: bash is required to install git hooks");
if (lastError) {
  console.error(lastError.message);
}
process.exit(1);

import { execSync } from "node:child_process";
import os from "node:os";

export function collectEnvironment(repoRoot) {
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    // ignore
  }
  let cpuModel = "unknown";
  try {
    const cpuinfo = execSync("grep -m1 'model name' /proc/cpuinfo", { encoding: "utf8" });
    cpuModel = cpuinfo.split(":")[1]?.trim() ?? cpuModel;
  } catch {
    // ignore
  }
  return {
    collectedAt: new Date().toISOString(),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpuModel,
    logicalCpus: os.cpus().length,
    memoryTotalBytes: os.totalmem(),
    nodeVersion: process.version,
    commitSha: commit,
    displayAvailable: Boolean(process.env.DISPLAY),
  };
}

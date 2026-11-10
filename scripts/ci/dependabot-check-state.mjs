// CI の check-runs API 応答から、ジョブ名 checks の状態を 1 語で返す。
// missing / pending / success / skipped / failure / cancelled など。
// 完了済みが複数あるときは started_at、同着なら id が新しい方を採用する。
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

let payload;
try {
  payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  console.log("error");
  process.exit(0);
}

const runs = Array.isArray(payload.check_runs)
  ? payload.check_runs.filter((run) => run && run.name === "checks")
  : [];

if (runs.length === 0) {
  console.log("missing");
  process.exit(0);
}

if (runs.some((run) => run.status !== "completed")) {
  console.log("pending");
  process.exit(0);
}

runs.sort((a, b) => {
  const byTime = String(a.started_at ?? "").localeCompare(String(b.started_at ?? ""));
  if (byTime !== 0) {
    return byTime;
  }
  return Number(a.id ?? 0) - Number(b.id ?? 0);
});

const conclusion = runs[runs.length - 1].conclusion;
console.log(typeof conclusion === "string" && conclusion.length > 0 ? conclusion : "unknown");

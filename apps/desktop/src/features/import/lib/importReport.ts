import type { ImportFailureReason, ImportReport } from "@swallow/shared";

const REASON_LABELS: Record<ImportFailureReason, string> = {
  unsupportedExtension: "対応していない形式です",
  notFound: "ファイルが見つかりません",
  notAFile: "ファイルではありません",
  io: "読み書きに失敗しました",
};

export function failureReasonLabel(reason: ImportFailureReason): string {
  return REASON_LABELS[reason];
}

export function summarizeImport(report: ImportReport): string {
  const imported = `${report.imported.length} 件を取り込みました`;
  if (report.failed.length === 0) {
    return imported;
  }
  return `${imported}（${report.failed.length} 件は失敗）`;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

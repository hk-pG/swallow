import type { ImportReport } from "@swallow/shared";
import { failureReasonLabel, fileName, summarizeImport } from "./lib/importReport";

interface Props {
  report: ImportReport | null;
  error: string | null;
  onDismiss: () => void;
}

export function ImportReportBanner({ report, error, onDismiss }: Props) {
  if (!report && !error) {
    return null;
  }
  const failed = report ? report.failed.length > 0 : true;

  return (
    <div className={failed ? "import-report failed" : "import-report"} role="status">
      <div className="import-report-header">
        <span>{report ? summarizeImport(report) : `取り込みに失敗しました: ${error}`}</span>
        <button type="button" className="text-button" onClick={onDismiss}>
          閉じる
        </button>
      </div>
      {report && report.failed.length > 0 && (
        <ul className="import-report-failures">
          {report.failed.map((f) => (
            <li key={f.path} title={`${f.path}\n${f.message}`}>
              {fileName(f.path)}: {failureReasonLabel(f.reason)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

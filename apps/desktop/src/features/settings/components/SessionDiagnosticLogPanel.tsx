import { useSessionDiagnosticLog } from "../hooks/useSessionDiagnosticLog";

export function SessionDiagnosticLogPanel() {
  const { log, loading, error, refresh } = useSessionDiagnosticLog();

  const onCopy = async () => {
    if (!log?.text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(log.text);
    } catch {
      // Clipboard may be unavailable in some WebView builds; selection still works.
    }
  };

  const helperText = (() => {
    if (loading) {
      return "読み込み中…";
    }
    if (error) {
      return error;
    }
    if (!log) {
      return "";
    }
    if (log.truncated) {
      const kb = Math.round(log.maxBytes / 1024);
      return `末尾 ${kb} KB までを表示しています（省略あり）。`;
    }
    if (!log.text) {
      return "この起動セッションのログはまだありません。";
    }
    return "読み取り専用です。内容を選択するか「コピー」でクリップボードへ。";
  })();

  return (
    <div className="settings-dev-log">
      <div className="settings-dev-log-actions">
        <button
          type="button"
          className="view-mode-button"
          disabled={loading}
          onClick={() => refresh()}
        >
          再読み込み
        </button>
        <button
          type="button"
          className="view-mode-button"
          disabled={loading || !log?.text}
          onClick={() => void onCopy()}
        >
          コピー
        </button>
      </div>
      {helperText ? <p className="inspector-muted settings-dev-log-hint">{helperText}</p> : null}
      <textarea
        className="inspector-input settings-dev-log-text"
        readOnly
        spellCheck={false}
        aria-label="現在の起動セッションの診断ログ"
        value={loading ? "" : (log?.text ?? "")}
        rows={12}
      />
    </div>
  );
}

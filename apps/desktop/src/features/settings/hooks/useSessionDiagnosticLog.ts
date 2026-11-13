import { useCallback, useEffect, useState } from "react";
import { getSessionDiagnosticLog, type SessionDiagnosticLog } from "../api";

export interface SessionDiagnosticLogState {
  log: SessionDiagnosticLog | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSessionDiagnosticLog(): SessionDiagnosticLogState {
  const [log, setLog] = useState<SessionDiagnosticLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getSessionDiagnosticLog()
      .then((result) => {
        setLog(result);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "ログを読み込めませんでした");
        setLog(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { log, loading, error, refresh };
}

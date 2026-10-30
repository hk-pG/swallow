import type { ItemMetadata } from "@swallow/shared";
import { useState } from "react";

/** Render with `key={item.id}` so an error from one item does not carry over to the next. */
interface TrashActionsProps {
  item: ItemMetadata | null;
  onTrash: () => Promise<void>;
  onRestore: () => Promise<void>;
  /** Resolves without changes when the user cancels the confirmation. */
  onPurge: () => Promise<void>;
}

export function TrashActions({ item, onTrash, onRestore, onPurge }: TrashActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="inspector-section trash-actions">
      {item.isDeleted ? (
        <>
          <button
            type="button"
            className="push-button"
            disabled={busy}
            onClick={() => void run(onRestore)}
          >
            復元
          </button>
          <button
            type="button"
            className="push-button danger"
            disabled={busy}
            onClick={() => void run(onPurge)}
          >
            完全に削除
          </button>
        </>
      ) : (
        <button
          type="button"
          className="push-button"
          disabled={busy}
          onClick={() => void run(onTrash)}
        >
          ゴミ箱へ移動
        </button>
      )}
      {error && (
        <p className="inspector-error" role="alert">
          操作に失敗しました: {error}
        </p>
      )}
    </section>
  );
}

import { type KeyboardEvent, useCallback, useEffect, useId, useState } from "react";
import { formatResolution } from "../lib/format";
import type { QuickLookScaleMode, QuickLookTarget } from "../lib/quickLook";
import { hasThumbnail, originalImageUrl } from "../lib/thumbnail";

interface QuickLookProps {
  libraryPath: string;
  target: QuickLookTarget;
  scaleMode: QuickLookScaleMode;
  onScaleModeChange: (mode: QuickLookScaleMode) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function QuickLook({
  libraryPath,
  target,
  scaleMode,
  onScaleModeChange,
  onClose,
  onPrev,
  onNext,
}: QuickLookProps) {
  const titleId = useId();
  const { item, playlist, index, isMultiSelection } = target;
  const fileName = `${item.name}.${item.ext}`;
  const previewable = hasThumbnail(item.ext);
  const src = previewable ? originalImageUrl(libraryPath, item.id) : null;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [item.id]);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onPrev, onNext]);

  const onDialogKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === " ") {
        e.preventDefault();
        onScaleModeChange(scaleMode === "fit" ? "actual" : "fit");
      }
    },
    [onScaleModeChange, scaleMode],
  );

  const positionLabel = `${index + 1} / ${playlist.length}`;
  const scopeHint = isMultiSelection
    ? `選択中の ${playlist.length} 件をプレビュー（← → で送り）`
    : `表示中の一覧をプレビュー（← → で送り）`;

  return (
    <div className="quick-look-backdrop" onClick={onClose} role="presentation">
      <div
        className="quick-look"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
      >
        <header className="quick-look-header">
          <div className="quick-look-title-block">
            <h2 id={titleId} className="quick-look-title" title={fileName}>
              {fileName}
            </h2>
            <p className="quick-look-meta">
              {formatResolution(item.width, item.height)} · {positionLabel}
            </p>
            <p className="quick-look-hint">{scopeHint}</p>
          </div>
          <div className="quick-look-actions">
            {previewable && (
              <button
                type="button"
                className="text-button"
                aria-pressed={scaleMode === "actual"}
                onClick={() => onScaleModeChange(scaleMode === "fit" ? "actual" : "fit")}
              >
                {scaleMode === "fit" ? "原寸表示" : "ウィンドウに合わせる"}
              </button>
            )}
            <button type="button" className="text-button" onClick={onClose}>
              閉じる (Esc)
            </button>
          </div>
        </header>
        <div
          className={
            scaleMode === "actual" ? "quick-look-stage quick-look-stage-actual" : "quick-look-stage"
          }
        >
          {!previewable ? (
            <p className="quick-look-unsupported">
              この形式（{item.ext.toUpperCase() || "不明"}）はクイックルックのプレビューに対応していません
            </p>
          ) : failed ? (
            <p className="quick-look-unsupported">画像を読み込めませんでした</p>
          ) : (
            <>
              {loading && <p className="quick-look-loading" aria-live="polite">読み込み中…</p>}
              <img
                key={src ?? item.id}
                className={scaleMode === "actual" ? "quick-look-image-actual" : "quick-look-image-fit"}
                src={src ?? undefined}
                alt={fileName}
                decoding="async"
                draggable={false}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            </>
          )}
        </div>
        {playlist.length > 1 && (
          <footer className="quick-look-footer">
            <button type="button" className="text-button" disabled={index === 0} onClick={onPrev}>
              前へ
            </button>
            <button
              type="button"
              className="text-button"
              disabled={index >= playlist.length - 1}
              onClick={onNext}
            >
              次へ
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/** Hint text for tests and docs. */
export function quickLookScopeHint(target: QuickLookTarget): string {
  return target.isMultiSelection
    ? `選択中の ${target.playlist.length} 件をプレビュー（← → で送り）`
    : `表示中の一覧をプレビュー（← → で送り）`;
}

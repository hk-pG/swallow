import { hasQuickLookPreview, type ItemMetadata, resolveItemPreviewKind } from "@swallow/shared";
import { type KeyboardEvent, useCallback, useEffect, useId, useState } from "react";
import { logPreviewFailure } from "../../../shared/diagnostic-log";
import { formatResolution } from "../../../shared/format";
import { ItemMediaPreview, itemFullPreviewUrl } from "../../items";
import type { QuickLookScaleMode, QuickLookTarget } from "../lib/quickLook";

interface QuickLookPreviewStageProps {
  libraryPath: string;
  item: ItemMetadata;
  scaleMode: QuickLookScaleMode;
  fileLabel: string;
  previewable: boolean;
  onFailedChange: (failed: boolean) => void;
}

function QuickLookPreviewStage({
  libraryPath,
  item,
  scaleMode,
  fileLabel,
  previewable,
  onFailedChange,
}: QuickLookPreviewStageProps) {
  const [loading, setLoading] = useState(previewable);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onFailedChange(false);
  }, [onFailedChange]);

  const handlePreviewError = useCallback(() => {
    logPreviewFailure({
      source: "quick-look",
      component: "QuickLook",
      itemId: item.id,
      ext: item.ext,
      src: itemFullPreviewUrl(libraryPath, item.id),
      fileSize: item.size,
    });
    setFailed(true);
    onFailedChange(true);
  }, [item.ext, item.id, item.size, libraryPath, onFailedChange]);

  if (failed) {
    return <p className="quick-look-unsupported">プレビューを読み込めませんでした</p>;
  }

  return (
    <>
      {loading && previewable && (
        <p className="quick-look-loading" aria-live="polite">
          読み込み中…
        </p>
      )}
      <ItemMediaPreview
        libraryPath={libraryPath}
        item={item}
        scaleMode={scaleMode}
        fileLabel={fileLabel}
        onLoadingChange={setLoading}
        onError={handlePreviewError}
      />
    </>
  );
}

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
  const previewKind = resolveItemPreviewKind(item.ext);
  const previewable = hasQuickLookPreview(item.ext);
  const supportsImageScale = previewKind === "image";
  const [failedItemId, setFailedItemId] = useState<string | null>(null);
  const previewFailed = failedItemId === item.id;

  const handlePreviewFailedChange = useCallback(
    (failed: boolean) => {
      setFailedItemId(failed ? item.id : null);
    },
    [item.id],
  );

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
      if (e.key === " " && supportsImageScale) {
        e.preventDefault();
        onScaleModeChange(scaleMode === "fit" ? "actual" : "fit");
      }
    },
    [onScaleModeChange, scaleMode, supportsImageScale],
  );

  const positionLabel = `${index + 1} / ${playlist.length}`;
  const scopeHint = isMultiSelection
    ? `選択中の ${playlist.length} 件をプレビュー（← → で送り）`
    : `表示中の一覧をプレビュー（← → で送り）`;

  return (
    <div className="quick-look-layer">
      <button
        type="button"
        className="quick-look-backdrop"
        aria-label="クイックルックを閉じる"
        onClick={onClose}
      />
      <div
        className="quick-look"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
            {supportsImageScale && previewable && !previewFailed && (
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
          <QuickLookPreviewStage
            key={item.id}
            libraryPath={libraryPath}
            item={item}
            scaleMode={scaleMode}
            fileLabel={fileName}
            previewable={previewable}
            onFailedChange={handlePreviewFailedChange}
          />
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

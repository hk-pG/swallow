import { type ItemId, resolveItemPreviewKind } from "@swallow/shared";
import { useEffect, useId, useRef, useState } from "react";
import { itemFullPreviewUrl } from "../lib/thumbnail";

export type ItemMediaPreviewScale = "fit" | "actual";

export interface ItemMediaPreviewItem {
  id: ItemId;
  ext: string;
  name: string;
}

interface ItemMediaPreviewProps {
  libraryPath: string;
  item: ItemMediaPreviewItem;
  scaleMode: ItemMediaPreviewScale;
  fileLabel: string;
  onLoadingChange?: (loading: boolean) => void;
  onError?: () => void;
}

const FONT_SAMPLE =
  "ABCDEFGabcdefg 0123456789\nあいうえお アイウエオ\nThe quick brown fox jumps over the lazy dog.";

/** Shared Quick Look / preview surface for images, video, fonts, and unsupported types. */
export function ItemMediaPreview({
  libraryPath,
  item,
  scaleMode,
  fileLabel,
  onLoadingChange,
  onError,
}: ItemMediaPreviewProps) {
  const kind = resolveItemPreviewKind(item.ext);

  if (kind === "unsupported") {
    return (
      <p className="quick-look-unsupported">
        この形式（{item.ext.toUpperCase() || "不明"}
        ）はクイックルックのプレビューに対応していません
      </p>
    );
  }

  const src = itemFullPreviewUrl(libraryPath, item.id);

  if (kind === "video") {
    return (
      <VideoPreview
        src={src}
        fileLabel={fileLabel}
        scaleMode={scaleMode}
        onLoadingChange={onLoadingChange}
        onError={onError}
      />
    );
  }

  if (kind === "font") {
    return (
      <FontPreview
        itemId={item.id}
        src={src}
        fileLabel={fileLabel}
        onLoadingChange={onLoadingChange}
        onError={onError}
      />
    );
  }

  return (
    <ImagePreview
      src={src}
      fileLabel={fileLabel}
      scaleMode={scaleMode}
      onLoadingChange={onLoadingChange}
      onError={onError}
    />
  );
}

function ImagePreview({
  src,
  fileLabel,
  scaleMode,
  onLoadingChange,
  onError,
}: {
  src: string;
  fileLabel: string;
  scaleMode: ItemMediaPreviewScale;
  onLoadingChange?: (loading: boolean) => void;
  onError?: () => void;
}) {
  return (
    <img
      className={scaleMode === "actual" ? "quick-look-image-actual" : "quick-look-image-fit"}
      src={src}
      alt={fileLabel}
      decoding="async"
      draggable={false}
      onLoad={() => onLoadingChange?.(false)}
      onError={() => {
        onLoadingChange?.(false);
        onError?.();
      }}
    />
  );
}

function VideoPreview({
  src,
  fileLabel,
  scaleMode,
  onLoadingChange,
  onError,
}: {
  src: string;
  fileLabel: string;
  scaleMode: ItemMediaPreviewScale;
  onLoadingChange?: (loading: boolean) => void;
  onError?: () => void;
}) {
  const className =
    scaleMode === "actual"
      ? "quick-look-video quick-look-video-actual"
      : "quick-look-video quick-look-video-fit";

  return (
    <video
      className={className}
      src={src}
      controls
      preload="metadata"
      aria-label={fileLabel}
      onLoadedData={() => onLoadingChange?.(false)}
      onError={() => {
        onLoadingChange?.(false);
        onError?.();
      }}
    >
      <track kind="captions" />
    </video>
  );
}

function FontPreview({
  itemId,
  src,
  fileLabel,
  onLoadingChange,
  onError,
}: {
  itemId: ItemId;
  src: string;
  fileLabel: string;
  onLoadingChange?: (loading: boolean) => void;
  onError?: () => void;
}) {
  const reactId = useId();
  const family = `swallow-preview-font-${itemId}-${reactId.replace(/:/g, "")}`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onErrorRef = useRef(onError);
  onLoadingChangeRef.current = onLoadingChange;
  onErrorRef.current = onError;

  useEffect(() => {
    setReady(false);
    setFailed(false);
    onLoadingChangeRef.current?.(true);

    if (typeof FontFace === "undefined") {
      onLoadingChangeRef.current?.(false);
      setFailed(true);
      onErrorRef.current?.();
      return;
    }

    const face = new FontFace(family, `url("${src}")`);
    let cancelled = false;
    let loadedFont: FontFace | null = null;
    void face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        loadedFont = loaded;
        document.fonts.add(loaded);
        setReady(true);
        onLoadingChangeRef.current?.(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onLoadingChangeRef.current?.(false);
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (loadedFont) {
        void document.fonts.delete(loadedFont);
      }
    };
  }, [family, src]);

  if (failed) {
    return <p className="quick-look-unsupported">フォントを読み込めませんでした</p>;
  }

  if (!ready) {
    return null;
  }

  return (
    <div
      className="quick-look-font-sample"
      role="img"
      style={{ fontFamily: family }}
      aria-label={fileLabel}
    >
      {FONT_SAMPLE}
    </div>
  );
}
